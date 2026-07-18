function isAdmin(username) {
  const admins = String(process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return admins.includes(String(username || '').toLowerCase());
}

function authorizeAdmin(req, res, next) {
  if (!isAdmin(req.user?.username)) return res.status(403).json({ error: 'Admin access required' });
  return next();
}

module.exports = { authorizeAdmin, isAdmin };
