import { jest } from '@jest/globals';
import { startTestServer, stopTestServer, registerUser, createAdmin, bearer } from './setup.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';

jest.setTimeout(120000);

let api;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  api = await startTestServer();
});

afterAll(stopTestServer);

describe('indexes', () => {
  test('only the required indexes exist, all declared through schema.index()', async () => {
    const keys = async (Model) => (await Model.collection.indexes()).map((i) => JSON.stringify(i.key));
    expect(await keys(User)).toEqual(['{"_id":1}', '{"email":1}', '{"interests":1}']);
    expect(await keys(Note)).toEqual(['{"_id":1}', '{"owner":1,"_id":-1}']);
    expect(await keys(Post)).toEqual(['{"_id":1}', '{"author":1,"_id":-1}']);
  });
});

describe('authentication', () => {
  test('register hashes the password and never returns it', async () => {
    const { user, token } = await registerUser(api, { email: 'hash@example.com' });
    expect(token).toEqual(expect.any(String));
    expect(user.password).toBeUndefined();
    const stored = await User.findById(user._id).select('+password').lean();
    expect(stored.password).toMatch(/^\$2[aby]\$12\$/);
  });

  test('register ignores attempts to self-assign admin', async () => {
    await api
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'Password123', role: 'admin' })
      .expect(400);
  });

  test('duplicate email is rejected', async () => {
    await registerUser(api, { email: 'dup@example.com' });
    await api.post('/api/auth/register').send({ name: 'X', email: 'DUP@example.com', password: 'Password123' }).expect(409);
  });

  test('login succeeds with correct credentials and fails otherwise', async () => {
    await registerUser(api, { email: 'login@example.com' });
    await api.post('/api/auth/login').send({ email: 'login@example.com', password: 'Password123' }).expect(200);
    await api.post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong-password' }).expect(401);
    await api.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Password123' }).expect(401);
  });

  test('protected routes require a valid token', async () => {
    await api.get('/api/notes').expect(401);
    await api.get('/api/notes').set(bearer('not-a-jwt')).expect(401);
  });
});

describe('notes (user role)', () => {
  test('CRUD on own notes with pagination', async () => {
    const { token } = await registerUser(api);
    const created = [];
    for (let i = 1; i <= 12; i += 1) {
      const res = await api.post('/api/notes').set(bearer(token)).send({ title: `Note ${i}`, content: 'body' }).expect(201);
      created.push(res.body);
    }

    const page1 = await api.get('/api/notes?page=1&limit=5').set(bearer(token)).expect(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(page1.body.items.map((n) => n.title)).toEqual(['Note 12', 'Note 11', 'Note 10', 'Note 9', 'Note 8']);
    const page3 = await api.get('/api/notes?page=3&limit=5').set(bearer(token)).expect(200);
    expect(page3.body.items).toHaveLength(2);

    const id = created[0]._id;
    await api.get(`/api/notes/${id}`).set(bearer(token)).expect(200);
    const updated = await api.patch(`/api/notes/${id}`).set(bearer(token)).send({ title: 'Renamed' }).expect(200);
    expect(updated.body.title).toBe('Renamed');
    await api.delete(`/api/notes/${id}`).set(bearer(token)).expect(204);
    await api.get(`/api/notes/${id}`).set(bearer(token)).expect(404);
  });

  test("users cannot read, update, or delete another user's notes", async () => {
    const owner = await registerUser(api);
    const intruder = await registerUser(api);
    const { body: note } = await api.post('/api/notes').set(bearer(owner.token)).send({ title: 'Secret' }).expect(201);

    await api.get(`/api/notes/${note._id}`).set(bearer(intruder.token)).expect(404);
    await api.patch(`/api/notes/${note._id}`).set(bearer(intruder.token)).send({ title: 'Hacked' }).expect(404);
    await api.delete(`/api/notes/${note._id}`).set(bearer(intruder.token)).expect(404);
    const list = await api.get('/api/notes').set(bearer(intruder.token)).expect(200);
    expect(list.body.total).toBe(0);
  });

  test('owner cannot be reassigned through the request body', async () => {
    const a = await registerUser(api);
    const b = await registerUser(api);
    await api.post('/api/notes').set(bearer(a.token)).send({ title: 'x', owner: b.user._id }).expect(400);
  });

  test('invalid ids are rejected', async () => {
    const { token } = await registerUser(api);
    await api.get('/api/notes/not-an-id').set(bearer(token)).expect(400);
  });

  test('users cannot reach admin routes', async () => {
    const { token } = await registerUser(api);
    await api.get('/api/admin/users').set(bearer(token)).expect(403);
    await api.get('/api/admin/notes').set(bearer(token)).expect(403);
  });
});

describe('admin role', () => {
  test('manages users: add, list, update, remove', async () => {
    const admin = await createAdmin(api);
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
    expect(updated.body.role).toBe('admin');

    await api.post('/api/auth/login').send({ email: 'managed@example.com', password: 'Password123' }).expect(200);

    await api.delete(`/api/admin/users/${created._id}`).set(bearer(admin.token)).expect(204);
    await api.get(`/api/admin/users/${created._id}`).set(bearer(admin.token)).expect(404);
  });

  test('deleting a user removes their notes and posts', async () => {
    const admin = await createAdmin(api);
    const victim = await registerUser(api);
    await api.post('/api/notes').set(bearer(victim.token)).send({ title: 'n' }).expect(201);
    await api.post('/api/posts').set(bearer(victim.token)).send({ title: 'p', body: 'b' }).expect(201);
    await api.delete(`/api/admin/users/${victim.user._id}`).set(bearer(admin.token)).expect(204);
    expect(await Note.countDocuments({ owner: victim.user._id })).toBe(0);
    expect(await Post.countDocuments({ author: victim.user._id })).toBe(0);
    await api.get('/api/notes').set(bearer(victim.token)).expect(401);
  });

  test('admin cannot delete or demote themselves', async () => {
    const admin = await createAdmin(api);
    await api.delete(`/api/admin/users/${admin.user._id}`).set(bearer(admin.token)).expect(400);
    await api.patch(`/api/admin/users/${admin.user._id}`).set(bearer(admin.token)).send({ role: 'user' }).expect(400);
  });

  test("views everyone's notes, optionally filtered by owner, and any single note", async () => {
    const admin = await createAdmin(api);
    const author = await registerUser(api);
    const { body: note } = await api.post('/api/notes').set(bearer(author.token)).send({ title: 'Visible to admin' }).expect(201);

    const all = await api.get('/api/admin/notes?limit=100').set(bearer(admin.token)).expect(200);
    expect(all.body.items.some((n) => n._id === note._id)).toBe(true);

    const filtered = await api.get(`/api/admin/notes?owner=${author.user._id}`).set(bearer(admin.token)).expect(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].owner.email).toBe(author.user.email);

    await api.get(`/api/notes/${note._id}`).set(bearer(admin.token)).expect(200);
    await api.patch(`/api/notes/${note._id}`).set(bearer(admin.token)).send({ title: 'x' }).expect(404);
  });

  test('admin keeps user capabilities for their own notes', async () => {
    const admin = await createAdmin(api);
    const { body } = await api.post('/api/notes').set(bearer(admin.token)).send({ title: 'Admin note' }).expect(201);
    const mine = await api.get('/api/notes').set(bearer(admin.token)).expect(200);
    expect(mine.body.items.map((n) => n._id)).toContain(body._id);
  });
});

describe('aggregations', () => {
  beforeAll(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
  });

  test('scenario 1: users grouped by interest, paginated in one pipeline', async () => {
    const a = await registerUser(api, { name: 'A', interests: ['chess', 'reading'] });
    await registerUser(api, { name: 'B', interests: ['chess'] });
    await registerUser(api, { name: 'C', interests: ['Reading', 'travel'] });
    await registerUser(api, { name: 'D', interests: [] });

    const res = await api.get('/api/users/interests?limit=2').set(bearer(a.token)).expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.items.map((g) => [g.interest, g.count])).toEqual([
      ['chess', 2],
      ['reading', 2],
    ]);
    expect(res.body.items[0].users.map((u) => u.name).sort()).toEqual(['A', 'B']);
    expect(res.body.items[0].users[0].password).toBeUndefined();

    const filtered = await api.get('/api/users/interests?interest=travel').set(bearer(a.token)).expect(200);
    expect(filtered.body.items).toEqual([{ interest: 'travel', count: 1, users: [expect.objectContaining({ name: 'C' })] }]);
  });

  test('scenario 2: posts of a user via $lookup, paginated', async () => {
    const author = await registerUser(api, { name: 'Writer' });
    const reader = await registerUser(api, { name: 'Reader' });
    for (let i = 1; i <= 7; i += 1) {
      await api.post('/api/posts').set(bearer(author.token)).send({ title: `Post ${i}`, body: 'content' }).expect(201);
    }
    await api.post('/api/posts').set(bearer(reader.token)).send({ title: 'Other', body: 'content' }).expect(201);

    const res = await api.get(`/api/users/${author.user._id}/posts?limit=5`).set(bearer(reader.token)).expect(200);
    expect(res.body.author.name).toBe('Writer');
    expect(res.body).toMatchObject({ total: 7, totalPages: 2, page: 1, limit: 5 });
    expect(res.body.items.map((p) => p.title)).toEqual(['Post 7', 'Post 6', 'Post 5', 'Post 4', 'Post 3']);

    const page2 = await api.get(`/api/users/${author.user._id}/posts?limit=5&page=2`).set(bearer(reader.token)).expect(200);
    expect(page2.body.items).toHaveLength(2);

    await api.get('/api/users/64b7f0c2a1b2c3d4e5f60718/posts').set(bearer(reader.token)).expect(404);
  });

  test('posts are visible to everyone and deletable only by author or admin', async () => {
    const author = await registerUser(api);
    const other = await registerUser(api);
    const { body: post } = await api.post('/api/posts').set(bearer(author.token)).send({ title: 'Public', body: 'hi' }).expect(201);
    await api.get(`/api/posts/${post._id}`).set(bearer(other.token)).expect(200);
    const list = await api.get('/api/posts').set(bearer(other.token)).expect(200);
    expect(list.body.items.some((p) => p._id === post._id)).toBe(true);
    await api.delete(`/api/posts/${post._id}`).set(bearer(other.token)).expect(404);
    await api.delete(`/api/posts/${post._id}`).set(bearer(author.token)).expect(204);
  });

  test('user profile and self-service update', async () => {
    const me = await registerUser(api, { name: 'Profile' });
    const updated = await api.patch('/api/auth/me').set(bearer(me.token)).send({ interests: ['Coding', 'coding', 'music'] }).expect(200);
    expect(updated.body.interests).toEqual(['coding', 'music']);
    const profile = await api.get(`/api/users/${me.user._id}`).set(bearer(me.token)).expect(200);
    expect(profile.body).toMatchObject({ name: 'Profile', interests: ['coding', 'music'] });
    expect(profile.body.email).toBeUndefined();
    await api.patch('/api/auth/me').set(bearer(me.token)).send({ role: 'admin' }).expect(400);
  });
});
