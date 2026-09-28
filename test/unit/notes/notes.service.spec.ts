import { jest } from '@jest/globals';

import { NotFoundException } from '@nestjs/common';
import { Role } from '../../../src/common/roles.js';
import { NotesRepository } from '../../../src/notes/notes.repository.js';
import { NotesService } from '../../../src/notes/notes.service.js';

type AnyFn = (...args: any[]) => any;

describe('NotesService', () => {
  const note = { _id: 'n1', title: 'T' };
  let repo: jest.Mocked<NotesRepository>;
  let service: NotesService;

  beforeEach(() => {
    repo = {
      findById: jest.fn<AnyFn>().mockResolvedValue(note),
      findOwned: jest.fn<AnyFn>().mockResolvedValue(null),
      updateOwned: jest.fn<AnyFn>().mockResolvedValue(null),
      deleteOwned: jest.fn<AnyFn>().mockResolvedValue(false),
    } as unknown as jest.Mocked<NotesRepository>;
    service = new NotesService(repo);
  });

  it('scopes reads to the owner for regular users', async () => {
    await expect(service.findVisible('n1', { id: 'u2', role: Role.User, name: '', email: '' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOwned).toHaveBeenCalledWith('n1', 'u2');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('lets admins read any note', async () => {
    await expect(service.findVisible('n1', { id: 'a1', role: Role.Admin, name: '', email: '' })).resolves.toBe(note);
  });

  it('returns 404 when updating or deleting a note the caller does not own', async () => {
    await expect(service.update('n1', 'u2', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('n1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ignores undefined fields and rejects empty updates', async () => {
    repo.updateOwned.mockResolvedValue(note as never);
    await service.update('n1', 'u1', { title: 'x', content: undefined });
    expect(repo.updateOwned).toHaveBeenCalledWith('n1', 'u1', { title: 'x' });
    await expect(service.update('n1', 'u1', {})).rejects.toThrow('Nothing to update');
  });
});
