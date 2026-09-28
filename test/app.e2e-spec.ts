import { getModelToken } from '@nestjs/mongoose';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app.factory';
import { LoginThrottle } from '../src/auth/schemas/login-throttle.schema';
import { Role } from '../src/common/roles';
import { Note } from '../src/notes/schemas/note.schema';
import { Post } from '../src/posts/schemas/post.schema';
import { User } from '../src/users/schemas/user.schema';

jest.setTimeout(120_000);

let mongo: MongoMemoryServer;
let app: NestFastifyApplication;
let api: TestAgent;
let users: Model<User>;
let notes: Model<Note>;
let posts: Model<Post>;
let throttles: Model<LoginThrottle>;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const uniqueEmail = (prefix = 'user') => `${prefix}${Math.random().toString(36).slice(2, 10)}@example.com`;

async function registerUser(overrides: Record<string, unknown> = {}) {
  const body = { name: 'Test User', email: uniqueEmail(), password: 'Password123', ...overrides };
  const res = await api.post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token as string, user: res.body.user, password: body.password as string };
}

async function createAdmin() {
  const email = uniqueEmail('admin');
  await users.create({ name: 'Admin', email, password: 'AdminPass123', role: Role.Admin });
  const res = await api.post('/api/auth/login').send({ email, password: 'AdminPass123' }).expect(200);
  return { token: res.body.token as string, user: res.body.user };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('secure-notes-test');
  app = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  api = request(app.getHttpServer());
  users = app.get(getModelToken(User.name));
  notes = app.get(getModelToken(Note.name));
  posts = app.get(getModelToken(Post.name));
  throttles = app.get(getModelToken(LoginThrottle.name));
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('indexes', () => {
  it('only the required indexes exist, all declared through schema.index()', async () => {
    const keys = async (model: Model<any>) => (await model.collection.indexes()).map((i) => JSON.stringify(i.key));
    expect(await keys(users)).toEqual(['{"_id":1}', '{"email":1}', '{"interests":1}']);
    expect(await keys(notes)).toEqual(['{"_id":1}', '{"owner":1,"_id":-1}']);
    expect(await keys(posts)).toEqual(['{"_id":1}', '{"author":1,"_id":-1}']);
  });
});

describe('authentication', () => {
  it('register hashes the password and never returns it', async () => {
    const { user, token } = await registerUser({ email: 'hash@example.com' });
    expect(token).toEqual(expect.any(String));
    expect(user.password).toBeUndefined();
    const stored = await users.findById(user._id).select('+password').lean();
    expect(stored?.password).toMatch(/^\$2[aby]\$12\$/);
  });

  it('register rejects attempts to self-assign admin', async () => {
    await api.post('/api/auth/register').send({ name: 'Eve', email: 'eve@example.com', password: 'Password123', role: 'admin' }).expect(400);
  });

  it('duplicate email is rejected with 409', async () => {
    await registerUser({ email: 'dup@example.com' });
    await api.post('/api/auth/register').send({ name: 'X', email: 'DUP@example.com', password: 'Password123' }).expect(409);
  });

  it('login succeeds with correct credentials and fails otherwise', async () => {
    await registerUser({ email: 'login@example.com' });
    await api.post('/api/auth/login').send({ email: 'login@example.com', password: 'Password123' }).expect(200);
    await api.post('/api/auth/login').set('X-Forwarded-For', '192.0.2.10').send({ email: 'login@example.com', password: 'WrongPass999' }).expect(401);
    await api.post('/api/auth/login').set('X-Forwarded-For', '192.0.2.10').send({ email: 'nobody@example.com', password: 'Password123' }).expect(401);
  });

  it('protected routes require a valid token', async () => {
    await api.get('/api/notes').expect(401);
    await api.get('/api/notes').set(bearer('not-a-jwt')).expect(401);
  });

  it('malformed JSON is a 400, not a 500', async () => {
    await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
  });

  it('prototype-poisoning payloads are rejected', async () => {
    await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"__proto__":{"admin":true},"email":"a@b.co","password":"x"}').expect(400);
  });
});

describe('notes (user role)', () => {
  it('CRUD on own notes with pagination', async () => {
    const { token } = await registerUser();
    const created = [];
    for (let i = 1; i <= 12; i += 1) {
      const res = await api.post('/api/notes').set(bearer(token)).send({ title: `Note ${i}`, content: 'body' }).expect(201);
      created.push(res.body);
    }
    const page1 = await api.get('/api/notes?page=1&limit=5').set(bearer(token)).expect(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(page1.body.items.map((n: { title: string }) => n.title)).toEqual(['Note 12', 'Note 11', 'Note 10', 'Note 9', 'Note 8']);
    const page3 = await api.get('/api/notes?page=3&limit=5').set(bearer(token)).expect(200);
    expect(page3.body.items).toHaveLength(2);

    const id = created[0]._id;
    await api.get(`/api/notes/${id}`).set(bearer(token)).expect(200);
    const updated = await api.patch(`/api/notes/${id}`).set(bearer(token)).send({ title: 'Renamed' }).expect(200);
    expect(updated.body).toMatchObject({ title: 'Renamed', content: 'body' });
    await api.delete(`/api/notes/${id}`).set(bearer(token)).set('Content-Type', 'application/json').expect(204);
    await api.get(`/api/notes/${id}`).set(bearer(token)).expect(404);
  });

  it("users cannot read, update, or delete another user's notes", async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const { body: note } = await api.post('/api/notes').set(bearer(owner.token)).send({ title: 'Secret' }).expect(201);
    await api.get(`/api/notes/${note._id}`).set(bearer(intruder.token)).expect(404);
    await api.patch(`/api/notes/${note._id}`).set(bearer(intruder.token)).send({ title: 'Hacked' }).expect(404);
    await api.delete(`/api/notes/${note._id}`).set(bearer(intruder.token)).expect(404);
    const list = await api.get('/api/notes').set(bearer(intruder.token)).expect(200);
    expect(list.body.total).toBe(0);
  });

  it('owner cannot be reassigned through the request body', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await api.post('/api/notes').set(bearer(a.token)).send({ title: 'x', owner: b.user._id }).expect(400);
  });

  it('invalid ids and page sizes are rejected', async () => {
    const { token } = await registerUser();
    await api.get('/api/notes/not-an-id').set(bearer(token)).expect(400);
    await api.get('/api/notes?limit=500').set(bearer(token)).expect(400);
  });

  it('users cannot reach admin routes', async () => {
    const { token } = await registerUser();
    await api.get('/api/admin/users').set(bearer(token)).expect(403);
    await api.get('/api/admin/notes').set(bearer(token)).expect(403);
  });
});

describe('admin role', () => {
  it('manages users: add, list, update, remove', async () => {
    const admin = await createAdmin();
    const { body: created } = await api
      .post('/api/admin/users')
      .set(bearer(admin.token))
      .send({ name: 'Managed', email: 'managed@example.com', password: 'Password123', role: 'user' })
      .expect(201);
    expect(created.password).toBeUndefined();

    const list = await api.get('/api/admin/users?limit=2').set(bearer(admin.token)).expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.total).toBeGreaterThan(2);

    const updated = await api.patch(`/api/admin/users/${created._id}`).set(bearer(admin.token)).send({ role: 'admin' }).expect(200);
    expect(updated.body).toMatchObject({ role: 'admin', name: 'Managed', email: 'managed@example.com' });

    await api.post('/api/auth/login').send({ email: 'managed@example.com', password: 'Password123' }).expect(200);
    await api.delete(`/api/admin/users/${created._id}`).set(bearer(admin.token)).expect(204);
    await api.get(`/api/admin/users/${created._id}`).set(bearer(admin.token)).expect(404);
  });

  it('deleting a user removes their notes and posts and ends their session', async () => {
    const admin = await createAdmin();
    const victim = await registerUser();
    await api.post('/api/notes').set(bearer(victim.token)).send({ title: 'n' }).expect(201);
    await api.post('/api/posts').set(bearer(victim.token)).send({ title: 'p', body: 'b' }).expect(201);
    await api.delete(`/api/admin/users/${victim.user._id}`).set(bearer(admin.token)).expect(204);
    expect(await notes.countDocuments({ owner: victim.user._id })).toBe(0);
    expect(await posts.countDocuments({ author: victim.user._id })).toBe(0);
    await api.get('/api/notes').set(bearer(victim.token)).expect(401);
  });

  it('admin cannot delete or demote themselves', async () => {
    const admin = await createAdmin();
    await api.delete(`/api/admin/users/${admin.user._id}`).set(bearer(admin.token)).expect(400);
    await api.patch(`/api/admin/users/${admin.user._id}`).set(bearer(admin.token)).send({ role: 'user' }).expect(400);
  });

  it("views everyone's notes, optionally filtered by owner, and any single note", async () => {
    const admin = await createAdmin();
    const author = await registerUser();
    const { body: note } = await api.post('/api/notes').set(bearer(author.token)).send({ title: 'Visible to admin' }).expect(201);

    const all = await api.get('/api/admin/notes?limit=100').set(bearer(admin.token)).expect(200);
    expect(all.body.items.some((n: { _id: string }) => n._id === note._id)).toBe(true);

    const filtered = await api.get(`/api/admin/notes?owner=${author.user._id}`).set(bearer(admin.token)).expect(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].owner.email).toBe(author.user.email);

    await api.get(`/api/notes/${note._id}`).set(bearer(admin.token)).expect(200);
    await api.patch(`/api/notes/${note._id}`).set(bearer(admin.token)).send({ title: 'x' }).expect(404);
  });

  it('admin keeps user capabilities for their own notes', async () => {
    const admin = await createAdmin();
    const { body } = await api.post('/api/notes').set(bearer(admin.token)).send({ title: 'Admin note' }).expect(201);
    const mine = await api.get('/api/notes').set(bearer(admin.token)).expect(200);
    expect(mine.body.items.map((n: { _id: string }) => n._id)).toContain(body._id);
  });
});

describe('aggregations', () => {
  beforeAll(async () => {
    await users.deleteMany({});
    await posts.deleteMany({});
  });

  it('scenario 1: users grouped by interest, paginated in one pipeline', async () => {
    const a = await registerUser({ name: 'A', interests: ['chess', 'reading'] });
    await registerUser({ name: 'B', interests: ['chess'] });
    await registerUser({ name: 'C', interests: ['Reading', 'travel'] });
    await registerUser({ name: 'D', interests: [] });

    const res = await api.get('/api/users/interests?limit=2').set(bearer(a.token)).expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.items.map((g: { interest: string; count: number }) => [g.interest, g.count])).toEqual([
      ['chess', 2],
      ['reading', 2],
    ]);
    expect(res.body.items[0].users.map((u: { name: string }) => u.name).sort()).toEqual(['A', 'B']);
    expect(res.body.items[0].users[0].password).toBeUndefined();

    const filtered = await api.get('/api/users/interests?interest=travel').set(bearer(a.token)).expect(200);
    expect(filtered.body.items).toEqual([{ interest: 'travel', count: 1, users: [expect.objectContaining({ name: 'C' })] }]);
  });

  it('scenario 2: posts of a user via $lookup, paginated', async () => {
    const author = await registerUser({ name: 'Writer' });
    const reader = await registerUser({ name: 'Reader' });
    for (let i = 1; i <= 7; i += 1) {
      await api.post('/api/posts').set(bearer(author.token)).send({ title: `Post ${i}`, body: 'content' }).expect(201);
    }
    await api.post('/api/posts').set(bearer(reader.token)).send({ title: 'Other', body: 'content' }).expect(201);

    const res = await api.get(`/api/users/${author.user._id}/posts?limit=5`).set(bearer(reader.token)).expect(200);
    expect(res.body.author.name).toBe('Writer');
    expect(res.body).toMatchObject({ total: 7, totalPages: 2, page: 1, limit: 5 });
    expect(res.body.items.map((p: { title: string }) => p.title)).toEqual(['Post 7', 'Post 6', 'Post 5', 'Post 4', 'Post 3']);
    const page2 = await api.get(`/api/users/${author.user._id}/posts?limit=5&page=2`).set(bearer(reader.token)).expect(200);
    expect(page2.body.items).toHaveLength(2);
    await api.get('/api/users/64b7f0c2a1b2c3d4e5f60718/posts').set(bearer(reader.token)).expect(404);
  });

  it('posts are visible to everyone and deletable only by author or admin', async () => {
    const author = await registerUser();
    const other = await registerUser();
    const { body: post } = await api.post('/api/posts').set(bearer(author.token)).send({ title: 'Public', body: 'hi' }).expect(201);
    await api.get(`/api/posts/${post._id}`).set(bearer(other.token)).expect(200);
    const list = await api.get('/api/posts').set(bearer(other.token)).expect(200);
    expect(list.body.items.some((p: { _id: string }) => p._id === post._id)).toBe(true);
    await api.delete(`/api/posts/${post._id}`).set(bearer(other.token)).expect(404);
    await api.delete(`/api/posts/${post._id}`).set(bearer(author.token)).expect(204);
  });

  it('user profile and self-service update', async () => {
    const me = await registerUser({ name: 'Profile' });
    const updated = await api.patch('/api/auth/me').set(bearer(me.token)).send({ interests: ['Coding', 'coding', 'music'] }).expect(200);
    expect(updated.body.user.interests).toEqual(['coding', 'music']);
    const profile = await api.get(`/api/users/${me.user._id}`).set(bearer(me.token)).expect(200);
    expect(profile.body).toMatchObject({ name: 'Profile', interests: ['coding', 'music'] });
    expect(profile.body.email).toBeUndefined();
    await api.patch('/api/auth/me').set(bearer(me.token)).send({ role: 'admin' }).expect(400);
  });
});

describe('session security', () => {
  it('logout revokes every token issued before it', async () => {
    const { token, user, password } = await registerUser();
    const second = await api.post('/api/auth/login').send({ email: user.email, password }).expect(200);
    await api.post('/api/auth/logout').set(bearer(token)).set('Content-Type', 'application/json').expect(204);
    await api.get('/api/auth/me').set(bearer(token)).expect(401);
    await api.get('/api/auth/me').set(bearer(second.body.token)).expect(401);
  });

  it('changing the password signs out other sessions and returns a fresh token', async () => {
    const { token } = await registerUser();
    const res = await api.patch('/api/auth/me').set(bearer(token)).send({ password: 'NewPassword456' }).expect(200);
    expect(res.body.token).toEqual(expect.any(String));
    await api.get('/api/auth/me').set(bearer(token)).expect(401);
    await api.get('/api/auth/me').set(bearer(res.body.token)).expect(200);
  });

  it("an admin changing a role revokes that user's sessions", async () => {
    const admin = await createAdmin();
    const target = await registerUser();
    await api.patch(`/api/admin/users/${target.user._id}`).set(bearer(admin.token)).send({ role: 'admin' }).expect(200);
    await api.get('/api/auth/me').set(bearer(target.token)).expect(401);
  });

  it('weak passwords are rejected', async () => {
    await api.post('/api/auth/register').send({ name: 'W', email: 'weak@example.com', password: 'onlyletters' }).expect(400);
    await api.post('/api/auth/register').send({ name: 'W', email: 'weak@example.com', password: '12345678' }).expect(400);
  });

  it('responses are not cacheable and carry strict security headers', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS allows only the configured frontend', async () => {
    const allowed = await api.get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await api.get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('brute-force protection', () => {
  const login = (ip: string, body: object) => api.post('/api/auth/login').set('X-Forwarded-For', ip).send(body);

  afterEach(() => throttles.deleteMany({}));

  it('locks an account after 5 failed passwords, even with the right password', async () => {
    const { user, password } = await registerUser();
    for (let i = 0; i < 5; i += 1) await login(`198.51.100.${i + 1}`, { email: user.email, password: 'WrongPass999' }).expect(401);
    const locked = await login('198.51.100.50', { email: user.email, password }).expect(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(locked.body.error).toMatch(/Too many failed sign-in attempts/);
  });

  it('a successful login resets the account failure count', async () => {
    const { user, password } = await registerUser();
    for (let i = 0; i < 4; i += 1) await login('198.51.100.60', { email: user.email, password: 'WrongPass999' }).expect(401);
    await login('198.51.100.61', { email: user.email, password }).expect(200);
    await login('198.51.100.62', { email: user.email, password: 'WrongPass999' }).expect(401);
    await login('198.51.100.63', { email: user.email, password }).expect(200);
    const stored = await users.findById(user._id).select('+failedLoginAttempts').lean();
    expect(stored?.failedLoginAttempts).toBe(0);
  });

  it('blocks an IP after 10 failed sign-ins across any accounts', async () => {
    const { user, password } = await registerUser();
    for (let i = 0; i < 10; i += 1) await login('203.0.113.7', { email: `nobody${i}@example.com`, password: 'WrongPass999' }).expect(401);
    const blocked = await login('203.0.113.7', { email: user.email, password }).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(1500);
    await login('203.0.113.8', { email: user.email, password }).expect(200);
  });
});

describe('API documentation', () => {
  it('serves the OpenAPI document with every route and the bearer scheme', async () => {
    const res = await api.get('/api/docs-json').expect(200);
    const operations = Object.values(res.body.paths as Record<string, object>).flatMap((methods) => Object.keys(methods));
    expect(operations).toHaveLength(24);
    expect(res.body.components.securitySchemes.jwt).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(res.body.paths['/api/users/interests'].get.summary).toMatch(/Scenario 1/);
    expect(res.body.paths['/api/users/{id}/posts'].get.summary).toMatch(/Scenario 2/);
  });

  it('redirects the bare API URL to the docs', async () => {
    const res = await api.get('/').expect(302);
    expect(res.headers.location).toBe('/api/docs');
  });

  it('serves the Swagger UI with a CSP scoped to the docs page', async () => {
    const res = await api.get('/api/docs').expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    const apiRes = await api.get('/api/health');
    expect(apiRes.headers['content-security-policy']).toMatch(/^default-src 'none'/);
  });
});
