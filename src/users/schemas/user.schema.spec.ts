import * as bcrypt from 'bcryptjs';
import { model } from 'mongoose';
import { Role } from '../../common/roles.js';
import { NoteSchema } from '../../notes/schemas/note.schema.js';
import { PostSchema } from '../../posts/schemas/post.schema.js';
import { hashPassword, User, UserSchema } from './user.schema.js';

const UserModel = model(User.name, UserSchema);

describe('schemas', () => {
  it('declares exactly the required indexes via schema.index()', () => {
    expect(UserSchema.indexes()).toEqual([
      [{ email: 1 }, expect.objectContaining({ unique: true })],
      [{ interests: 1 }, expect.any(Object)],
    ]);
    expect(NoteSchema.indexes()).toEqual([[{ owner: 1, _id: -1 }, expect.any(Object)]]);
    expect(PostSchema.indexes()).toEqual([[{ author: 1, _id: -1 }, expect.any(Object)]]);
  });

  it('hashes passwords with bcrypt cost 12', async () => {
    const hash = await hashPassword('Password123');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Password123', hash)).toBe(true);
  });

  it('never serialises the password or security counters', () => {
    const user = new UserModel({ name: 'A', email: 'a@example.com', password: 'h', failedLoginAttempts: 2, lockUntil: new Date(), tokenVersion: 3 });
    const json = user.toJSON();
    for (const field of ['password', 'failedLoginAttempts', 'lockUntil', 'tokenVersion']) expect(json).not.toHaveProperty(field);
  });

  it('defaults to the user role and normalises email and interests', () => {
    const user = new UserModel({ name: ' A ', email: ' A@Example.COM ', password: 'x', interests: [' Chess '] });
    expect(user.role).toBe(Role.User);
    expect(user.email).toBe('a@example.com');
    expect([...user.interests]).toEqual(['chess']);
  });
});
