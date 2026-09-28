/**
 * End-to-end check against a running API (local or deployed).
 *
 *   API_URL=https://secure-notes-api-ebon.vercel.app WEB_ORIGIN=https://secure-notes-web.vercel.app npm run e2e
 *
 * Requires the seed data (npm run seed). Every record it creates is removed at the end.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com', password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345' };
const USER_PASSWORD = 'User@12345';

let passed = 0;
let failed = 0;
const cleanup = [];

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${err.message}`);
  }
}

function expect(actual, expected, label = 'value') {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

const login = async (email, password) => {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  expect(res.status, 200, `login ${email}`);
  return res.data;
};

console.log(`\nE2E against ${API_URL}\n`);

console.log('Health & auth');
await check('health endpoint responds', async () => {
  const res = await call('GET', '/health');
  expect(res.status, 200, 'status');
});

const admin = await login(ADMIN.email, ADMIN.password);
const alice = await login('alice@example.com', USER_PASSWORD);
const bilal = await login('bilal@example.com', USER_PASSWORD);

await check('login returns a token and never the password', async () => {
  ok(alice.token.split('.').length === 3, 'token is not a JWT');
  ok(!('password' in alice.user), 'password leaked in login response');
});
await check('wrong password is rejected with 401', async () => {
  expect((await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'wrong-password' } })).status, 401, 'status');
});
await check('unknown email is rejected with the same 401', async () => {
  expect((await call('POST', '/auth/login', { body: { email: 'ghost@example.com', password: 'whatever1' } })).status, 401, 'status');
});
await check('protected routes require a token', async () => {
  expect((await call('GET', '/notes')).status, 401, 'no token');
  expect((await call('GET', '/notes', { token: 'forged.token.value' })).status, 401, 'forged token');
});
await check('register cannot self-assign admin', async () => {
  const res = await call('POST', '/auth/register', { body: { name: 'Mallory', email: 'mallory@example.com', password: 'Password123', role: 'admin' } });
  expect(res.status, 400, 'status');
});
await check('NoSQL operator injection in login is rejected', async () => {
  const res = await call('POST', '/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } });
  expect(res.status, 400, 'status');
});

console.log('\nNotes (user role)');
await check('user lists own notes with pagination metadata', async () => {
  const res = await call('GET', '/notes?page=2&limit=5', { token: alice.token });
  expect(res.status, 200, 'status');
  expect(res.data.page, 2, 'page');
  expect(res.data.limit, 5, 'limit');
  expect(res.data.total, 12, 'total');
  expect(res.data.totalPages, 3, 'totalPages');
  ok(res.data.items.every((n) => n.owner === alice.user._id), 'list contains notes from another user');
});

let noteId;
await check('user creates, reads, updates, and deletes a note', async () => {
  const created = await call('POST', '/notes', { token: alice.token, body: { title: 'E2E note', content: 'hello' } });
  expect(created.status, 201, 'create');
  noteId = created.data._id;
  expect((await call('GET', `/notes/${noteId}`, { token: alice.token })).status, 200, 'read');
  const updated = await call('PATCH', `/notes/${noteId}`, { token: alice.token, body: { title: 'E2E note (edited)' } });
  expect(updated.data.title, 'E2E note (edited)', 'updated title');
});
await check("another user cannot read, edit, or delete that note", async () => {
  expect((await call('GET', `/notes/${noteId}`, { token: bilal.token })).status, 404, 'read');
  expect((await call('PATCH', `/notes/${noteId}`, { token: bilal.token, body: { title: 'x' } })).status, 404, 'update');
  expect((await call('DELETE', `/notes/${noteId}`, { token: bilal.token })).status, 404, 'delete');
});
await check('admin can view any single note but not edit it', async () => {
  expect((await call('GET', `/notes/${noteId}`, { token: admin.token })).status, 200, 'admin read');
  expect((await call('PATCH', `/notes/${noteId}`, { token: admin.token, body: { title: 'x' } })).status, 404, 'admin update');
});
await check('owner deletes the note', async () => {
  expect((await call('DELETE', `/notes/${noteId}`, { token: alice.token })).status, 204, 'delete');
  expect((await call('GET', `/notes/${noteId}`, { token: alice.token })).status, 404, 'gone');
});
await check('users cannot reach admin routes', async () => {
  expect((await call('GET', '/admin/users', { token: alice.token })).status, 403, 'users');
  expect((await call('GET', '/admin/notes', { token: alice.token })).status, 403, 'notes');
});

console.log('\nAdmin');
await check('admin lists users with pagination and no password hashes', async () => {
  const res = await call('GET', '/admin/users?limit=3', { token: admin.token });
  expect(res.status, 200, 'status');
  expect(res.data.items.length, 3, 'page size');
  ok(res.data.total >= 7, `expected at least 7 users, got ${res.data.total}`);
  ok(res.data.items.every((u) => !('password' in u)), 'password hash leaked');
});

let managedId;
await check('admin adds, updates, and removes a user', async () => {
  const created = await call('POST', '/admin/users', {
    token: admin.token,
    body: { name: 'E2E Managed', email: 'e2e-managed@example.com', password: 'Password123', interests: ['testing'] },
  });
  expect(created.status, 201, 'create');
  managedId = created.data._id;
  cleanup.push(() => call('DELETE', `/admin/users/${managedId}`, { token: admin.token }));
  const updated = await call('PATCH', `/admin/users/${managedId}`, { token: admin.token, body: { role: 'admin', name: 'E2E Promoted' } });
  expect(updated.data.role, 'admin', 'role');
  expect((await call('DELETE', `/admin/users/${managedId}`, { token: admin.token })).status, 204, 'delete');
  expect((await call('GET', `/admin/users/${managedId}`, { token: admin.token })).status, 404, 'gone');
  cleanup.pop();
});
await check("admin views everyone's notes and filters by owner", async () => {
  const all = await call('GET', '/admin/notes?limit=100', { token: admin.token });
  const owners = new Set(all.data.items.map((n) => n.owner?._id));
  ok(owners.size > 1, 'expected notes from several owners');
  const filtered = await call('GET', `/admin/notes?owner=${bilal.user._id}`, { token: admin.token });
  expect(filtered.data.total, 12, "bilal's note count");
  ok(filtered.data.items.every((n) => n.owner._id === bilal.user._id), 'filter leaked other owners');
});
await check('admin cannot delete their own account', async () => {
  expect((await call('DELETE', `/admin/users/${admin.user._id}`, { token: admin.token })).status, 400, 'status');
});

console.log('\nPosts & aggregations');
let postId;
await check('user publishes a post visible to everyone', async () => {
  const created = await call('POST', '/posts', { token: alice.token, body: { title: 'E2E post', body: 'public' } });
  expect(created.status, 201, 'create');
  postId = created.data._id;
  cleanup.push(() => call('DELETE', `/posts/${postId}`, { token: admin.token }));
  expect((await call('GET', `/posts/${postId}`, { token: bilal.token })).status, 200, 'visible to others');
  const feed = await call('GET', '/posts?limit=5', { token: bilal.token });
  expect(feed.data.items[0]._id, postId, 'newest first');
});
await check('scenario 1: users grouped by interest in one aggregation', async () => {
  const res = await call('GET', '/users/interests?limit=10', { token: alice.token });
  expect(res.status, 200, 'status');
  const chess = res.data.items.find((g) => g.interest === 'chess');
  ok(chess, 'chess group missing');
  expect(chess.count, 3, 'chess members');
  const counts = res.data.items.map((g) => g.count);
  ok(counts.every((c, i) => i === 0 || counts[i - 1] >= c), 'groups not sorted by count');
  const filtered = await call('GET', '/users/interests?interest=travel', { token: alice.token });
  expect(filtered.data.items.length, 1, 'filtered groups');
  expect(filtered.data.items[0].interest, 'travel', 'filtered interest');
});
await check('scenario 2: a user posts via $lookup with pagination', async () => {
  const res = await call('GET', `/users/${alice.user._id}/posts?limit=2`, { token: bilal.token });
  expect(res.status, 200, 'status');
  expect(res.data.author.name, 'Alice Rahman', 'author');
  expect(res.data.items.length, 2, 'page size');
  expect(res.data.items[0]._id, postId, 'newest first');
  ok(res.data.total >= 5, `expected at least 5 posts, got ${res.data.total}`);
});
await check('only the author or an admin can delete a post', async () => {
  expect((await call('DELETE', `/posts/${postId}`, { token: bilal.token })).status, 404, 'other user');
  expect((await call('DELETE', `/posts/${postId}`, { token: alice.token })).status, 204, 'author');
  cleanup.pop();
});

console.log('\nTransport security');
await check('CORS allows the frontend origin', async () => {
  const res = await fetch(`${API_URL}/api/health`, { headers: { Origin: WEB_ORIGIN } });
  expect(res.headers.get('access-control-allow-origin'), WEB_ORIGIN, 'allow-origin');
});
await check('CORS does not allow an unknown origin', async () => {
  const res = await fetch(`${API_URL}/api/health`, { headers: { Origin: 'https://evil.example' } });
  ok(!res.headers.get('access-control-allow-origin'), 'unknown origin was allowed');
});
await check('security headers are present', async () => {
  const res = await fetch(`${API_URL}/api/health`);
  for (const header of ['x-content-type-options', 'strict-transport-security', 'x-frame-options']) {
    ok(res.headers.get(header), `missing ${header}`);
  }
  ok(!res.headers.get('x-powered-by'), 'x-powered-by is exposed');
});

await Promise.allSettled(cleanup.map((fn) => fn()));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
