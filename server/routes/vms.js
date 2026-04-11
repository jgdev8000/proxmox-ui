import { Router } from 'express';
import { createClient } from '../services/proxmox.js';

const router = Router();

function pve(req) {
  return createClient(req.session.pve.ticket, req.session.pve.csrfToken);
}

// List all VMs/CTs visible to the authenticated user
router.get('/', async (req, res) => {
  try {
    const client = pve(req);
    const { data } = await client.get('/cluster/resources', { params: { type: 'vm' } });
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch VMs' });
  }
});

// Get VM/CT detail (status + config)
router.get('/:node/:type(qemu|lxc)/:vmid', async (req, res) => {
  const { node, type, vmid } = req.params;
  const client = pve(req);
  try {
    const [statusRes, configRes] = await Promise.all([
      client.get(`/nodes/${node}/${type}/${vmid}/status/current`),
      client.get(`/nodes/${node}/${type}/${vmid}/config`),
    ]);
    res.json({
      status: statusRes.data.data,
      config: configRes.data.data,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch VM detail' });
  }
});

// Get RRD monitoring data
router.get('/:node/:type(qemu|lxc)/:vmid/rrddata', async (req, res) => {
  const { node, type, vmid } = req.params;
  const timeframe = req.query.timeframe || 'hour';
  try {
    const client = pve(req);
    const { data } = await client.get(`/nodes/${node}/${type}/${vmid}/rrddata`, {
      params: { timeframe },
    });
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// VM/CT power actions
const ALLOWED_ACTIONS = ['start', 'stop', 'shutdown', 'reboot', 'reset'];

router.post('/:node/:type(qemu|lxc)/:vmid/:action', async (req, res) => {
  const { node, type, vmid, action } = req.params;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }
  try {
    const client = pve(req);
    const { data } = await client.post(`/nodes/${node}/${type}/${vmid}/status/${action}`);
    res.json({ taskid: data.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: `Failed to ${action} VM` });
  }
});

// Update VM/CT config
const USER_FIELDS = ['ide2', 'boot', 'description'];
const ADMIN_FIELDS = ['cores', 'memory', 'sockets'];

router.put('/:node/:type(qemu|lxc)/:vmid/config', async (req, res) => {
  const { node, type, vmid } = req.params;
  const isAdmin = req.session.pve.isAdmin;
  const allowed = isAdmin ? [...USER_FIELDS, ...ADMIN_FIELDS] : USER_FIELDS;

  const params = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      params[key] = req.body[key];
    }
  }

  if (Object.keys(params).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const client = pve(req);
    await client.put(`/nodes/${node}/${type}/${vmid}/config`, new URLSearchParams(params));
    res.json({ ok: true });
  } catch (err) {
    const msg = err.response?.data?.errors
      ? Object.values(err.response.data.errors).join(', ')
      : 'Failed to update config';
    res.status(err.response?.status || 500).json({ error: msg });
  }
});

// List storages on a node (that have ISO content)
router.get('/:node/storage', async (req, res) => {
  const { node } = req.params;
  try {
    const client = pve(req);
    const { data } = await client.get(`/nodes/${node}/storage`);
    const isoStorages = data.data.filter((s) =>
      s.content && s.content.split(',').includes('iso')
    );
    res.json(isoStorages);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list storages' });
  }
});

// List ISOs on a storage
router.get('/:node/storage/:storage/isos', async (req, res) => {
  const { node, storage } = req.params;
  try {
    const client = pve(req);
    const { data } = await client.get(`/nodes/${node}/storage/${storage}/content`, {
      params: { content: 'iso' },
    });
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list ISOs' });
  }
});

// Get next free VMID
router.get('/nextid', async (req, res) => {
  try {
    const client = pve(req);
    const { data } = await client.get('/cluster/nextid');
    res.json({ vmid: data.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to get next VMID' });
  }
});

// List cluster nodes
router.get('/nodes', async (req, res) => {
  try {
    const client = pve(req);
    const { data } = await client.get('/nodes');
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list nodes' });
  }
});

// List all storages on a node (for disk creation)
router.get('/:node/storage-all', async (req, res) => {
  const { node } = req.params;
  try {
    const client = pve(req);
    const { data } = await client.get(`/nodes/${node}/storage`);
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list storages' });
  }
});

// List available network bridges on a node
router.get('/:node/networks', async (req, res) => {
  const { node } = req.params;
  try {
    const client = pve(req);
    const { data } = await client.get(`/nodes/${node}/network`, { params: { type: 'bridge' } });
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list networks' });
  }
});

// Create a VM
router.post('/:node/qemu', async (req, res) => {
  const { node } = req.params;
  const {
    vmid, name, cores, memory, sockets,
    scsi0, ide2, net0, boot,
    ostype, bios, machine, description,
  } = req.body;

  if (!vmid || !name) {
    return res.status(400).json({ error: 'vmid and name are required' });
  }

  const params = {
    vmid,
    name,
    cores: cores || 1,
    memory: memory || 2048,
    sockets: sockets || 1,
    ostype: ostype || 'l26',
    bios: bios || 'seabios',
    scsihw: 'virtio-scsi-single',
  };

  if (scsi0) params.scsi0 = scsi0;
  if (ide2) params.ide2 = ide2;
  if (net0) params.net0 = net0;
  if (boot) params.boot = boot;
  if (machine) params.machine = machine;
  if (description) params.description = description;

  try {
    const client = pve(req);
    const { data } = await client.post(
      `/nodes/${node}/qemu`,
      new URLSearchParams(params)
    );
    res.json({ taskid: data.data, vmid });
  } catch (err) {
    const msg = err.response?.data?.errors
      ? Object.values(err.response.data.errors).join(', ')
      : err.response?.data?.message || 'Failed to create VM';
    res.status(err.response?.status || 500).json({ error: msg });
  }
});

// ── Backups ──

// List backups for a VM
router.get('/:node/:type(qemu|lxc)/:vmid/backups', async (req, res) => {
  const { node, type, vmid } = req.params;
  try {
    const client = pve(req);
    // Get all storages that support backup content
    const { data: storageData } = await client.get(`/nodes/${node}/storage`);
    const backupStorages = storageData.data.filter((s) =>
      s.content && s.content.split(',').includes('backup')
    );

    const allBackups = [];
    for (const s of backupStorages) {
      try {
        const { data } = await client.get(`/nodes/${node}/storage/${s.storage}/content`, {
          params: { content: 'backup', vmid },
        });
        allBackups.push(...data.data.map((b) => ({ ...b, storage: s.storage })));
      } catch {}
    }

    allBackups.sort((a, b) => (b.ctime || 0) - (a.ctime || 0));
    res.json(allBackups);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list backups' });
  }
});

// Create a backup
router.post('/:node/:type(qemu|lxc)/:vmid/backup', async (req, res) => {
  const { node, type, vmid } = req.params;
  const { storage, mode, compress, notes } = req.body;
  try {
    const client = pve(req);
    const params = {
      vmid,
      mode: mode || 'snapshot',
      compress: compress || 'zstd',
    };
    if (storage) params.storage = storage;
    if (notes) params.notes = notes;

    const { data } = await client.post(
      `/nodes/${node}/vzdump`,
      new URLSearchParams(params)
    );
    res.json({ taskid: data.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to create backup' });
  }
});

// Restore a backup
router.post('/:node/:type(qemu|lxc)/:vmid/restore', async (req, res) => {
  const { node, type, vmid } = req.params;
  const { archive, storage } = req.body;
  if (!archive) {
    return res.status(400).json({ error: 'archive (volid) is required' });
  }
  try {
    const client = pve(req);
    const params = { vmid, archive, force: 1 };
    if (storage) params.storage = storage;

    const { data } = await client.post(
      `/nodes/${node}/qemu`,
      new URLSearchParams(params)
    );
    res.json({ taskid: data.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to restore backup' });
  }
});

// Delete a backup
router.delete('/:node/backup/:volid', async (req, res) => {
  const { node, volid } = req.params;
  // volid comes URL-encoded, e.g. local:backup/vzdump-qemu-100-...
  try {
    const client = pve(req);
    const storage = volid.split(':')[0];
    await client.delete(`/nodes/${node}/storage/${storage}/content/${volid}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to delete backup' });
  }
});

// ── Backup Schedules ──

// Get backup schedule for a specific VM
router.get('/:node/:type(qemu|lxc)/:vmid/backup-schedule', async (req, res) => {
  const { vmid } = req.params;
  try {
    const client = pve(req);
    const { data } = await client.get('/cluster/backup');
    const jobs = data.data.filter((job) => {
      const vmlist = (job.vmid || '').split(',').map((v) => v.trim());
      return vmlist.includes(String(vmid)) || job.all === 1;
    });
    res.json(jobs);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to get backup schedule' });
  }
});

// Create a backup schedule for a VM
router.post('/:node/:type(qemu|lxc)/:vmid/backup-schedule', async (req, res) => {
  const { vmid } = req.params;
  const { schedule, storage, mode, compress, retention } = req.body;
  try {
    const client = pve(req);
    const params = {
      vmid: String(vmid),
      schedule: schedule || 'daily',
      mode: mode || 'snapshot',
      compress: compress || 'zstd',
      enabled: 1,
      'prune-backups': retention || 'keep-last=3',
    };
    if (storage) params.storage = storage;

    await client.post('/cluster/backup', new URLSearchParams(params));
    res.json({ ok: true });
  } catch (err) {
    const msg = err.response?.data?.message || 'Failed to create backup schedule';
    res.status(err.response?.status || 500).json({ error: msg });
  }
});

// Update a backup schedule
router.put('/backup-job/:jobid', async (req, res) => {
  const { jobid } = req.params;
  const { enabled, schedule, storage, mode, compress, retention } = req.body;
  try {
    const client = pve(req);
    const params = {};
    if (enabled !== undefined) params.enabled = enabled ? 1 : 0;
    if (schedule) params.schedule = schedule;
    if (storage) params.storage = storage;
    if (mode) params.mode = mode;
    if (compress) params.compress = compress;
    if (retention) params['prune-backups'] = retention;

    await client.put(`/cluster/backup/${jobid}`, new URLSearchParams(params));
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to update backup schedule' });
  }
});

// Delete a backup schedule
router.delete('/backup-job/:jobid', async (req, res) => {
  const { jobid } = req.params;
  try {
    const client = pve(req);
    await client.delete(`/cluster/backup/${jobid}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to delete backup schedule' });
  }
});

export default router;
