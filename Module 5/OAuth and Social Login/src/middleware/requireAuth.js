'use strict';
// middleware/requireAuth.js — verifies the Bearer token and sets req.user
// Given — do not modify. This is the middleware from LU51.
// It is used in the /api routes to protect them from unauthenticated access.

const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match  = header.match(/^Bearer (.+)$/i);
  if (!match) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Bearer token required' },
    });
  }
  try {
    req.user = verifyToken(match[1]);
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' },
    });
  }
}

module.exports = requireAuth;
