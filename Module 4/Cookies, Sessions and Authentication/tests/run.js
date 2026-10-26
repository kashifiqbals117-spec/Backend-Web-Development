'use strict';

/**
 * LU 48 — Session Authentication Test Suite
 */
require('dotenv').config();
const http = require('http');
const app = require('../src/app');
const sessionStore = require('../src/session/sessionStore');
const prisma = require('../src/db/prisma');

const server = http.createServer(app);

function request(server, options, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr ? addr.port : 0;
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody: data,
        });
      });
    });

    req.on('error', reject);
    if (body !== undefined) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!opts.headers['Content-Type']) {
        req.setHeader('Content-Type', 'application/json');
      }
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

async function runTests() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\nLU 48 — Session Authentication Test Suite\n');

  try {
    // ── Suite 1: sessionStore Unit Tests ────────────────────────────────────
    console.log('Suite 1: sessionStore unit methods');
    {
      sessionStore.clear();
      const sid = sessionStore.create(999, 50);
      assert(typeof sid === 'string' && sid.length === 64, 'Creates opaque 64-hex-char session ID');

      const session = sessionStore.get(sid);
      assert(session && session.userId === 999, 'Resolves session by session ID with correct userId');
      assert(session && !session.passwordHash && !session.password, 'Session store never contains credentials');

      // Test TTL expiration removal during reads
      await new Promise((r) => setTimeout(r, 60));
      const expiredSession = sessionStore.get(sid);
      assert(expiredSession === null, 'get() returns null for expired session');
      assert(sessionStore.get(sid) === null, 'Expired session was purged from store');

      // Test manual destruction
      const activeSid = sessionStore.create(888);
      assert(sessionStore.destroy(activeSid) === true, 'destroy() returns true on deleting active session');
      assert(sessionStore.get(activeSid) === null, 'Destroyed session cannot be retrieved');
    }

    // ── Suite 2: POST /auth/login Validation & Credential Checking ───────────
    console.log('\nSuite 2: POST /auth/login credential verification');
    {
      // Missing credentials
      const res1 = await request(server, { method: 'POST', path: '/auth/login' }, {});
      assert(res1.status === 401, 'Status 401 on missing email and password');
      assert(res1.body?.error?.code === 'INVALID_CREDENTIALS', 'Error code INVALID_CREDENTIALS on missing fields');

      // Wrong password
      const res2 = await request(server, { method: 'POST', path: '/auth/login' }, {
        email: 'sam@example.com',
        password: 'WrongPassword!99',
      });
      assert(res2.status === 401, 'Status 401 on incorrect password');
      assert(res2.body?.error?.code === 'INVALID_CREDENTIALS', 'Generic INVALID_CREDENTIALS prevents enumeration');

      // Non-existent user
      const res3 = await request(server, { method: 'POST', path: '/auth/login' }, {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      });
      assert(res3.status === 401, 'Status 401 on nonexistent user');
      assert(res3.body?.error?.code === 'INVALID_CREDENTIALS', 'Generic error for non-existent user');
    }

    // ── Suite 3: POST /auth/login Success & Cookie Setting ──────────────────
    console.log('\nSuite 3: Successful login & signed cookie');
    let authCookie = '';
    {
      const res = await request(server, { method: 'POST', path: '/auth/login' }, {
        email: 'sam@example.com',
        password: 'SessionDemo!48',
      });
      assert(res.status === 200, `Status 200 on valid login (got ${res.status})`);
      assert(res.body?.user?.email === 'sam@example.com', 'Response contains user profile');
      assert(!res.body?.passwordHash && !res.body?.user?.passwordHash, 'Response does NOT leak passwordHash');

      const setCookie = res.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.length > 0, 'Response includes Set-Cookie header');

      const cookieStr = (setCookie || [])[0] || '';
      assert(cookieStr.startsWith('sid='), 'Cookie name is sid');
      assert(cookieStr.toLowerCase().includes('httponly'), 'Cookie has HttpOnly flag');
      assert(cookieStr.toLowerCase().includes('samesite=lax'), 'Cookie has SameSite=Lax');
      assert(cookieStr.toLowerCase().includes('path=/'), 'Cookie has Path=/');

      // Capture cookie for subsequent requests
      authCookie = cookieStr.split(';')[0];
    }

    // ── Suite 4: GET /auth/me Protected Identity ────────────────────────────
    console.log('\nSuite 4: GET /auth/me authentication');
    {
      // Missing cookie
      const resNoCookie = await request(server, { method: 'GET', path: '/auth/me' });
      assert(resNoCookie.status === 401, `Status 401 when cookie is missing (got ${resNoCookie.status})`);
      assert(resNoCookie.body?.error?.code === 'AUTH_REQUIRED', 'Error code AUTH_REQUIRED when missing cookie');

      // Tampered / invalid signed cookie
      const tamperedCookie = 'sid=s%3Ainvalid-fake-session-id.tamperedSignature';
      const resTampered = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: tamperedCookie },
      });
      assert(resTampered.status === 401, `Status 401 on tampered cookie (got ${resTampered.status})`);
      assert(resTampered.body?.error?.code === 'AUTH_REQUIRED', 'Generic AUTH_REQUIRED on invalid signature');

      // Valid signed cookie
      const resValid = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: authCookie },
      });
      assert(resValid.status === 200, `Status 200 with valid session cookie (got ${resValid.status})`);
      assert(resValid.body?.user?.email === 'sam@example.com' || resValid.body?.email === 'sam@example.com', 'Identity resolved correctly');
      assert(!resValid.body?.user?.passwordHash && !resValid.body?.passwordHash, 'Identity does not expose passwordHash');
    }

    // ── Suite 5: POST /auth/logout & Session Invalidation ────────────────────
    console.log('\nSuite 5: POST /auth/logout & cookie clearing');
    {
      const resLogout = await request(server, {
        method: 'POST',
        path: '/auth/logout',
        headers: { Cookie: authCookie },
      });
      assert(resLogout.status === 200, `Logout returns 200 (got ${resLogout.status})`);

      const setCookie = resLogout.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.length > 0, 'Logout sets cookie header to clear');
      const clearedCookie = (setCookie || [])[0] || '';
      assert(
        clearedCookie.includes('sid=;') ||
        clearedCookie.includes('sid=') && (clearedCookie.includes('Expires=Thu, 01 Jan 1970') || clearedCookie.includes('Max-Age=0')),
        'Cookie is cleared with past expiration or empty value'
      );

      // Verify that the invalidated session cookie can no longer access /auth/me
      const resAfterLogout = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: authCookie },
      });
      assert(resAfterLogout.status === 401, `Status 401 on /auth/me after logout (got ${resAfterLogout.status})`);
      assert(resAfterLogout.body?.error?.code === 'AUTH_REQUIRED', 'Session was destroyed on the server');
    }

  } finally {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
