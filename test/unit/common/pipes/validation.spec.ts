import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { LoginDto } from '../../../../src/auth/dto/login.dto.js';
import { RegisterDto } from '../../../../src/auth/dto/register.dto.js';
import { UpdateProfileDto } from '../../../../src/auth/dto/update-profile.dto.js';
import { CreateNoteDto } from '../../../../src/notes/dto/note.dto.js';
import { AdminCreateUserDto } from '../../../../src/users/dto/admin-user.dto.js';
import { ParseObjectIdPipe } from '../../../../src/common/pipes/parse-object-id.pipe.js';
import { createValidationPipe } from '../../../../src/common/pipes/validation.pipe.js';

const pipe = createValidationPipe();
const body = (metatype: new () => object): ArgumentMetadata => ({ type: 'body', metatype });
const validate = (metatype: new () => object, value: unknown) => pipe.transform(value, body(metatype));

describe('request validation', () => {
  const base = { name: 'Ada', email: ' ADA@Example.com ', password: 'Password123' };

  it('normalises email and de-duplicates interests', async () => {
    const dto = await validate(RegisterDto, { ...base, interests: ['Chess', 'chess', ' Reading '] });
    expect(dto).toMatchObject({ email: 'ada@example.com', interests: ['chess', 'reading'] });
  });

  it.each(['short1', 'onlyletters', '1234567890'])('rejects weak password %s', async (password) => {
    await expect(validate(RegisterDto, { ...base, password })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown fields such as role, blocking privilege escalation', async () => {
    await expect(validate(RegisterDto, { ...base, role: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateProfileDto, { role: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects NoSQL operator payloads', async () => {
    await expect(validate(LoginDto, { email: { $gt: '' }, password: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let the client choose a note owner', async () => {
    await expect(validate(CreateNoteDto, { title: 'x', owner: '64b7f0c2a1b2c3d4e5f60718' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateNoteDto, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restricts admin-assigned roles to known values', async () => {
    await expect(validate(AdminCreateUserDto, { ...base, role: 'admin' })).resolves.toMatchObject({ role: 'admin' });
    await expect(validate(AdminCreateUserDto, { ...base, role: 'superuser' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports field-level details', async () => {
    const error = await validate(RegisterDto, { ...base, password: 'short1' }).catch((e) => e);
    expect(error.getResponse()).toMatchObject({ error: 'Validation failed', details: [expect.objectContaining({ path: 'password' })] });
  });
});

describe('ParseObjectIdPipe', () => {
  const idPipe = new ParseObjectIdPipe();

  it('accepts ObjectIds and rejects anything else', () => {
    expect(idPipe.transform('64b7f0c2a1b2c3d4e5f60718')).toBe('64b7f0c2a1b2c3d4e5f60718');
    for (const bad of ['123', 'zzzzzzzzzzzzzzzzzzzzzzzz', { $ne: null }, undefined]) {
      expect(() => idPipe.transform(bad)).toThrow(BadRequestException);
    }
  });
});
