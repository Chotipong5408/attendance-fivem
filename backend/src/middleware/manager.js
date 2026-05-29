function managerMiddleware(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'head')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin or Head access required' });
  }
  next();
}

module.exports = managerMiddleware;
