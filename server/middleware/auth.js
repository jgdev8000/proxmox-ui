export default function requireAuth(req, res, next) {
  if (!req.session?.pve) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
