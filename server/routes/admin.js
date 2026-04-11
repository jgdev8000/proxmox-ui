import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '../services/proxmox.js';
import requireAdmin from '../middleware/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logosDir = path.join(__dirname, '..', '..', 'logos');

const router = Router();
router.use(requireAdmin);

function pve(req) {
  return createClient(req.session.pve.ticket, req.session.pve.csrfToken);
}

// ── Users ──

router.get('/users', async (req, res) => {
  try {
    const { data } = await pve(req).get('/access/users');
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', async (req, res) => {
  const { userid, password, comment } = req.body;
  if (!userid || !password) {
    return res.status(400).json({ error: 'userid and password required' });
  }
  try {
    await pve(req).post('/access/users',
      new URLSearchParams({ userid, password, comment: comment || '' })
    );
    res.json({ ok: true });
  } catch (err) {
    const msg = err.response?.data?.errors
      ? Object.values(err.response.data.errors).join(', ')
      : 'Failed to create user';
    res.status(err.response?.status || 500).json({ error: msg });
  }
});

router.delete('/users/:userid', async (req, res) => {
  try {
    await pve(req).delete(`/access/users/${encodeURIComponent(req.params.userid)}`);
    // Also remove logo if exists
    const username = req.params.userid.split('@')[0];
    const logoPath = path.join(logosDir, `${username}.png`);
    if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to delete user' });
  }
});

router.put('/users/:userid/password', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'password required' });
  }
  try {
    await pve(req).put('/access/password',
      new URLSearchParams({
        userid: req.params.userid,
        password,
      })
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to change password' });
  }
});

// ── VMs (admin sees all) ──

router.get('/vms', async (req, res) => {
  try {
    const { data } = await pve(req).get('/cluster/resources', { params: { type: 'vm' } });
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list VMs' });
  }
});

// ── ACLs ──

router.get('/acls', async (req, res) => {
  try {
    const { data } = await pve(req).get('/access/acl');
    res.json(data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to list ACLs' });
  }
});

router.put('/acls', async (req, res) => {
  const { path: aclPath, users, roles } = req.body;
  if (!aclPath || !users || !roles) {
    return res.status(400).json({ error: 'path, users, and roles required' });
  }
  try {
    await pve(req).put('/access/acl',
      new URLSearchParams({ path: aclPath, users, roles })
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to set ACL' });
  }
});

router.delete('/acls', async (req, res) => {
  const { path: aclPath, users, roles } = req.body;
  if (!aclPath || !users || !roles) {
    return res.status(400).json({ error: 'path, users, and roles required' });
  }
  try {
    await pve(req).put('/access/acl',
      new URLSearchParams({ path: aclPath, users, roles, delete: 1 })
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to remove ACL' });
  }
});

// ── Logo upload ──

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/users/:userid/logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file provided' });
  }
  const username = req.params.userid.split('@')[0];
  const dest = path.join(logosDir, `${username}.png`);
  fs.mkdirSync(logosDir, { recursive: true });
  fs.writeFileSync(dest, req.file.buffer);
  res.json({ ok: true });
});

router.delete('/users/:userid/logo', (req, res) => {
  const username = req.params.userid.split('@')[0];
  const logoPath = path.join(logosDir, `${username}.png`);
  if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
  res.json({ ok: true });
});

export default router;
