// requireRole factory.
//
// requireRole(...allowedRoles) returns an Express middleware that:
// 1. Responds 401 if req.user is missing.
// 2. Responds 403 if req.user.role is NOT in allowedRoles.
// 3. Otherwise calls next().

module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient role' },
      });
    }
    next();
  };
};
