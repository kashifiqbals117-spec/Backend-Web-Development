const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');

const router = express.Router();

const GENERIC_AUTH_ERROR = {
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      !name ||
      typeof name !== 'string' ||
      !name.trim() ||
      !email ||
      typeof email !== 'string' ||
      !email.trim() ||
      !password ||
      typeof password !== 'string' ||
      !password.trim()
    ) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Name, email, and password are required',
        },
      });
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@')) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Valid email is required',
        },
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'User with this email already exists',
        },
      });
    }

    const cost = Number(process.env.BCRYPT_COST) || 12;
    const passwordHash = await bcrypt.hash(password, cost);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        passwordHash,
      },
    });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message: 'User registered successfully',
      user: safeUser,
      ...safeUser,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'User with this email already exists',
        },
      });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    const trimmedEmail = email.trim();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

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

module.exports = router;
