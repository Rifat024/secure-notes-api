import bcrypt from 'bcryptjs';
import { User, ROLES, hashPassword } from '../../src/models/User.js';

describe('User model', () => {
  test('hashPassword produces a bcrypt hash with cost 12', async () => {
    const hash = await hashPassword('Password123');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Password123', hash)).toBe(true);
  });

  test('comparePassword checks against the stored hash', async () => {
    const user = new User({ name: 'A', email: 'a@example.com', password: await hashPassword('Password123') });
    expect(await user.comparePassword('Password123')).toBe(true);
    expect(await user.comparePassword('wrong')).toBe(false);
  });

  test('toJSON never exposes the password or security counters', () => {
    const user = new User({ name: 'A', email: 'a@example.com', password: 'secret-hash', failedLoginAttempts: 2, lockUntil: new Date(), tokenVersion: 3 });
    const json = user.toJSON();
    for (const field of ['password', 'failedLoginAttempts', 'lockUntil', 'tokenVersion']) {
      expect(json).not.toHaveProperty(field);
    }
  });

  test('defaults to the user role and normalises email and interests', () => {
    const user = new User({ name: ' A ', email: ' A@Example.COM ', password: 'x', interests: [' Chess '] });
    expect(user.role).toBe(ROLES.USER);
    expect(user.email).toBe('a@example.com');
    expect(user.interests).toEqual(['chess']);
  });

  test('declares exactly the email and interests indexes', () => {
    expect(User.schema.indexes()).toEqual([
      [{ email: 1 }, expect.objectContaining({ unique: true })],
      [{ interests: 1 }, expect.any(Object)],
    ]);
  });
});
