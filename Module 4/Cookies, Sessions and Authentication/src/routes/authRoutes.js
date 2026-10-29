'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const sessionStore = require('../session/sessionStore');
const requireSession = require('../middleware/requireSession');

const router = express.Router();

const GENERIC_AUTH_ERROR = {
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

/**
 * Cookie options helper for session cookie management.
 */
function getCookieConfig() {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  const ttlMs = Number(process.env.SESSION_TTL_MS) || 3600000;

  return {
    setOptions: {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlMs,
      signed: true,
    },
    clearOptions: {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    },
    ttlMs,
  };
}

/**
 * POST /auth/login
 * Validates credentials, creates a server session, and sets signed `sid` cookie.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    // Look up user by email with case-insensitive fallback
    let user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user && trimmedEmail.toLowerCase() !== trimmedEmail) {
      user = await prisma.user.findUnique({
        where: { email: trimmedEmail.toLowerCase() },
      });
    }

    if (!user) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    // Verify password against stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    // Create opaque server session
    const { setOptions, ttlMs } = getCookieConfig();
    const sid = sessionStore.create(user.id, ttlMs);

    // Set signed cookie on the response
    res.cookie('sid', sid, setOptions);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      message: 'Login successful',
      user: safeUser,
      ...safeUser,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/me
 * Protected identity endpoint that resolves the signed session cookie.
 */
router.get('/me', requireSession, async (req, res, next) => {
  try {
    return res.status(200).json({
      user: req.user,
      ...req.user,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/logout
 * Destroys server-side session and clears cookie using matching options.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const sid = (req.signedCookies && req.signedCookies.sid) || (req.cookies && req.cookies.sid);
    if (sid && typeof sid === 'string') {
      sessionStore.destroy(sid);
    }

    const { clearOptions } = getCookieConfig();
    res.clearCookie('sid', clearOptions);

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
