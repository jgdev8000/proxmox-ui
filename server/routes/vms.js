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

export default router;
