import {
  objectId,
  registerBody,
  loginBody,
  noteBody,
  noteUpdateBody,
  adminCreateUserBody,
  updateProfileBody,
  adminNotesQuery,
} from '../../src/utils/validation.js';

const VALID_ID = '64b7f0c2a1b2c3d4e5f60718';

describe('objectId', () => {
  test('accepts a 24-character hex id', () => {
    expect(objectId.safeParse(VALID_ID).success).toBe(true);
  });

  test.each(['123', 'not-an-object-id-at-all!', 'zzzzzzzzzzzzzzzzzzzzzzzz', '64b7f0c2a1b2c3d4e5f6071'])('rejects %s', (value) => {
    expect(objectId.safeParse(value).success).toBe(false);
  });
});

describe('registerBody', () => {
  const base = { name: 'Ada', email: 'ADA@Example.com ', password: 'Password123' };

  test('normalises email and de-duplicates lower-cased interests', () => {
    const parsed = registerBody.parse({ ...base, interests: ['Chess', 'chess', ' Reading '] });
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.interests).toEqual(['chess', 'reading']);
  });

  test('rejects short passwords', () => {
    expect(registerBody.safeParse({ ...base, password: 'short' }).success).toBe(false);
  });

  test('rejects unknown keys such as role, blocking privilege escalation', () => {
    expect(registerBody.safeParse({ ...base, role: 'admin' }).success).toBe(false);
  });

  test('rejects operator injection in place of a string', () => {
    expect(loginBody.safeParse({ email: { $gt: '' }, password: 'x' }).success).toBe(false);
  });
});

describe('note schemas', () => {
  test('requires a non-empty title', () => {
    expect(noteBody.safeParse({ title: '   ' }).success).toBe(false);
    expect(noteBody.safeParse({ title: 'Hello' }).success).toBe(true);
  });

  test('does not allow the owner to be supplied by the client', () => {
    expect(noteBody.safeParse({ title: 'x', owner: VALID_ID }).success).toBe(false);
  });

  test('update requires at least one field', () => {
    expect(noteUpdateBody.safeParse({}).success).toBe(false);
    expect(noteUpdateBody.safeParse({ content: 'new' }).success).toBe(true);
  });
});

describe('user management schemas', () => {
  test('admin create accepts a role, restricted to known roles', () => {
    const base = { name: 'Bob', email: 'bob@example.com', password: 'Password123' };
    expect(adminCreateUserBody.safeParse({ ...base, role: 'admin' }).success).toBe(true);
    expect(adminCreateUserBody.safeParse({ ...base, role: 'superuser' }).success).toBe(false);
  });

  test('profile update cannot change role and cannot be empty', () => {
    expect(updateProfileBody.safeParse({ role: 'admin' }).success).toBe(false);
    expect(updateProfileBody.safeParse({}).success).toBe(false);
  });

  test('admin notes owner filter must be an ObjectId', () => {
    expect(adminNotesQuery.safeParse({ owner: VALID_ID }).success).toBe(true);
    expect(adminNotesQuery.safeParse({ owner: { $ne: null } }).success).toBe(false);
  });
});
