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

export default router;
