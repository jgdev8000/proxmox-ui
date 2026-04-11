import { Router } from 'express';
import { createClient } from '../services/proxmox.js';

const router = Router();

// Request a VNC proxy ticket for a Proxmox node shell (admin only)
// Must be before the VM route
router.post('/node/:node', async (req, res) => {
  if (!req.session.pve.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { node } = req.params;
  try {
    const client = createClient(req.session.pve.ticket, req.session.pve.csrfToken);

    // Get the node's IP so we can connect the websocket to the right host
    const { data: nodesData } = await client.get('/nodes');
    const nodeInfo = nodesData.data.find((n) => n.node === node);

    const { data } = await client.post(`/nodes/${node}/termproxy`,
      new URLSearchParams({})
    );
    res.json({
      port: data.data.port,
      ticket: data.data.ticket,
      node,
      // Pass the node IP if available, so the websocket can connect directly
      nodeIp: nodeInfo?.ip || null,
    });
  } catch (err) {
    console.error('[console] Node termproxy error:', JSON.stringify(err.response?.data || err.message));
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || 'Failed to create node terminal proxy' });
  }
});

// Request a VNC proxy ticket for a VM/CT
router.post('/:node/:type(qemu|lxc)/:vmid', async (req, res) => {
  const { node, type, vmid } = req.params;
  try {
    const client = createClient(req.session.pve.ticket, req.session.pve.csrfToken);
    const { data } = await client.post(`/nodes/${node}/${type}/${vmid}/vncproxy`,
      new URLSearchParams({ websocket: 1 })
    );
    res.json({
      port: data.data.port,
      ticket: data.data.ticket,
      node,
      type,
      vmid,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to create VNC proxy' });
  }
});

export default router;
