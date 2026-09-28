import mongoose from 'mongoose';
import { z } from 'zod';
import { ROLES } from '../models/User.js';

export const objectId = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value), 'Invalid id');

export const idParams = z.object({ id: objectId });

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const name = z.string().trim().min(1).max(80);
const interests = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(20)
  .transform((list) => [...new Set(list)]);

export const registerBody = z.object({ name, email, password, interests: interests.optional() }).strict();

export const loginBody = z.object({ email, password: z.string().min(1).max(72) }).strict();

export const updateProfileBody = z
  .object({ name: name.optional(), password: password.optional(), interests: interests.optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const adminCreateUserBody = registerBody
  .extend({ role: z.enum(Object.values(ROLES)).optional() })
  .strict();

export const adminUpdateUserBody = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: z.enum(Object.values(ROLES)).optional(),
    interests: interests.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const noteBody = z
  .object({ title: z.string().trim().min(1).max(200), content: z.string().max(20000).optional() })
  .strict();

export const noteUpdateBody = noteBody.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const postBody = z
  .object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20000) })
  .strict();

export const paginationQuery = z
  .object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() })
  .passthrough();

export const adminNotesQuery = paginationQuery.extend({ owner: objectId.optional() });

export const interestGroupsQuery = paginationQuery.extend({
  interest: z.string().trim().toLowerCase().min(1).max(40).optional(),
});
