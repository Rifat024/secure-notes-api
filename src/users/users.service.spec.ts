import { jest } from '@jest/globals';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../common/roles.js';
import { NotesRepository } from '../notes/notes.repository.js';
import { PostsRepository } from '../posts/posts.repository.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

type AnyFn = (...args: any[]) => any;

describe('UsersService', () => {
  const admin = { id: new Types.ObjectId().toHexString(), role: Role.Admin, name: 'Admin', email: 'a@example.com' };
  let users: jest.Mocked<UsersRepository>;
  let notes: jest.Mocked<NotesRepository>;
  let posts: jest.Mocked<PostsRepository>;
  let service: UsersService;

  beforeEach(() => {
    users = { delete: jest.fn<AnyFn>(), findForUpdate: jest.fn<AnyFn>(), save: jest.fn<AnyFn>((u) => Promise.resolve(u)) } as unknown as jest.Mocked<UsersRepository>;
    notes = { deleteAllByOwner: jest.fn<AnyFn>() } as unknown as jest.Mocked<NotesRepository>;
    posts = { deleteAllByAuthor: jest.fn<AnyFn>() } as unknown as jest.Mocked<PostsRepository>;
    service = new UsersService(users, notes, posts);
  });

  it('deletes a user together with their notes and posts', async () => {
    users.delete.mockResolvedValue(true);
    const id = new Types.ObjectId().toHexString();
    await service.adminDelete(id, admin);
    expect(notes.deleteAllByOwner).toHaveBeenCalled();
    expect(posts.deleteAllByAuthor).toHaveBeenCalled();
  });

  it('refuses to let admins delete or demote themselves', async () => {
    await expect(service.adminDelete(admin.id, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminUpdate(admin.id, { role: Role.User }, admin)).rejects.toThrow('Admins cannot change their own role');
  });

  it('returns 404 for unknown users', async () => {
    users.delete.mockResolvedValue(false);
    await expect(service.adminDelete(new Types.ObjectId().toHexString(), admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revokes sessions when an admin changes a role, but not for a rename', async () => {
    const target = { role: Role.User, tokenVersion: 4, toJSON: () => ({}) };
    users.findForUpdate.mockResolvedValue(target as never);
    await service.adminUpdate('u1', { name: 'Renamed' }, admin);
    expect(target.tokenVersion).toBe(4);
    await service.adminUpdate('u1', { role: Role.Admin }, admin);
    expect(target.tokenVersion).toBe(5);
  });
});
