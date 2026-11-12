'use strict';
// middleware/rateLimiter.js — strict IP-based rate limiter for authentication routes.

const rateLimit = require('express-rate-limit');

/*
 * Multi-instance / Distributed Deployment Note (Redis-backed store):
 *
 * By default, `express-rate-limit` uses an in-memory `MemoryStore`, which keeps
 * hit counters inside each Node.js process's local memory. That works for a single
 * instance, but fails in a multi-instance deployment behind a load balancer:
 *   1. Each instance maintains separate counters, so an attacker whose requests are
 *      routed across N instances can make up to N * max attempts before being blocked.
 *   2. Counters are lost whenever an instance restarts or scales down.
 *
 * To enforce a shared global limit across all instances, replace the default store
 * with a Redis-backed store using `rate-limit-redis` and a Redis client (e.g. `redis`
 * via `process.env.REDIS_URL`):
 *
 *   const { RedisStore } = require('rate-limit-redis');
 *   const { createClient } = require('redis');
 *   const redisClient = createClient({ url: process.env.REDIS_URL });
 *   // await redisClient.connect();
 *
 *   // Pass inside rateLimit({ ... }):
 *   store: new RedisStore({
 *     sendCommand: (...args) => redisClient.sendCommand(args),
 *   }),
 *
 * With `RedisStore`, every instance atomically increments and reads the same keys
 * and TTL windows in Redis, ensuring consistent enforcement regardless of which
 * backend instance handles each request.
 */
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per window per IP
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Only failed requests (status >= 400) count toward the limit
  handler: (req, res, _next, options) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);

    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(options.statusCode).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
      },
    });
  },
});
