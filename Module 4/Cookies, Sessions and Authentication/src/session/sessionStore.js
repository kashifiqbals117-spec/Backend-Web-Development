'use strict';

const crypto = require('crypto');

// In-memory session store mapping opaque session ID -> { userId, expiresAt }
const sessions = new Map();

/**
 * Creates a new session for a user and stores it with an expiration timestamp.
 *
 * @param {number|string|object} userId - User identifier or options object
 * @param {number} [ttlMs] - Session duration in milliseconds
 * @returns {string} The generated opaque session ID
 */
function create(userIdOrOptions, ttlMs) {
  let userId = userIdOrOptions;
  let ttl = ttlMs;

  if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
    userId = userIdOrOptions.userId;
    ttl = userIdOrOptions.ttlMs ?? ttlMs;
  }

  const defaultTtl = Number(process.env.SESSION_TTL_MS) || 3600000;
  const finalTtl = (typeof ttl === 'number' && !Number.isNaN(ttl) && ttl > 0)
    ? ttl
    : defaultTtl;

  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + finalTtl;

  sessions.set(sessionId, { userId, expiresAt });
  return sessionId;
}

/**
 * Retrieves a session by its opaque session ID.
 * Automatically deletes and returns null if the session has expired.
 *
 * @param {string} sessionId
 * @returns {{ userId: number|string, expiresAt: number } | null}
 */
function get(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  // Remove expired sessions during reads
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return { userId: session.userId, expiresAt: session.expiresAt };
}

/**
 * Destroys a session by removing it from the store.
 *
 * @param {string} sessionId
 * @returns {boolean} True if the session existed and was removed, false otherwise
 */
function destroy(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  return sessions.delete(sessionId);
}

/**
 * Clears all active sessions (useful for test resets).
 */
function clear() {
  sessions.clear();
}

/**
 * Returns the current number of active sessions in memory.
 *
 * @returns {number}
 */
function size() {
  return sessions.size;
}

module.exports = {
  create,
  get,
  destroy,
  clear,
  size,
  sessions,
  // Aliases for flexibility
  createSession: create,
  getSession: get,
  destroySession: destroy,
};
