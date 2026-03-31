import { Router } from 'express';
import { createClient } from '../services/proxmox.js';

const router = Router();

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
