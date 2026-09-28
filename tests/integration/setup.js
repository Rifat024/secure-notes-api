import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { createApp } from '../../src/app.js';
import { User, ROLES } from '../../src/models/User.js';

let mongo;

export async function startTestServer() {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri('secure-notes-test'));
  return request(createApp());
}

export async function stopTestServer() {
  await disconnectDB();
  await mongo?.stop();
}

export async function registerUser(api, overrides = {}) {
  const body = {
    name: 'Test User',
    email: `user${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: 'Password123',
    ...overrides,
  };
  const res = await api.post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token, user: res.body.user, password: body.password };
}

export async function createAdmin(api) {
  const email = `admin${Math.random().toString(36).slice(2, 10)}@example.com`;
  await User.create({ name: 'Admin', email, password: 'AdminPass123', role: ROLES.ADMIN });
  const res = await api.post('/api/auth/login').send({ email, password: 'AdminPass123' }).expect(200);
  return { token: res.body.token, user: res.body.user };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
