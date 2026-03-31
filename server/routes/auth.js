import { Router } from 'express';
import { authenticate } from '../services/proxmox.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password, realm } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const data = await authenticate(username, password, realm || 'pam');
    req.session.pve = {
      ticket: data.ticket,
      csrfToken: data.CSRFPreventionToken,
      username: data.username,
    };
    res.json({ username: data.username });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = status === 401 ? 'Invalid credentials' : 'Authentication failed';
    res.status(status).json({ error: message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session?.pve) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ username: req.session.pve.username });
});

export default router;
