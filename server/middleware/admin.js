export default function requireAdmin(req, res, next) {
  if (!req.session?.pve?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
