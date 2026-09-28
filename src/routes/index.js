import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../utils/validation.js';
import * as auth from '../controllers/authController.js';
import * as notes from '../controllers/noteController.js';
import * as posts from '../controllers/postController.js';
import * as users from '../controllers/userController.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts, please try again later' },
});

const page = { query: v.paginationQuery };
const byId = { params: v.idParams };

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/auth/register', authLimiter, validate({ body: v.registerBody }), h(auth.register));
router.post('/auth/login', authLimiter, validate({ body: v.loginBody }), h(auth.login));

router.use(authenticate);

router.get('/auth/me', h(auth.me));
router.patch('/auth/me', validate({ body: v.updateProfileBody }), h(auth.updateMe));

router.get('/notes', validate(page), h(notes.listMyNotes));
router.post('/notes', validate({ body: v.noteBody }), h(notes.createNote));
router.get('/notes/:id', validate(byId), h(notes.getNote));
router.patch('/notes/:id', validate({ ...byId, body: v.noteUpdateBody }), h(notes.updateNote));
router.delete('/notes/:id', validate(byId), h(notes.deleteNote));

router.get('/posts', validate(page), h(posts.listPosts));
router.post('/posts', validate({ body: v.postBody }), h(posts.createPost));
router.get('/posts/:id', validate(byId), h(posts.getPost));
router.delete('/posts/:id', validate(byId), h(posts.deletePost));

router.get('/users/interests', validate({ query: v.interestGroupsQuery }), h(users.usersByInterest));
router.get('/users/:id', validate(byId), h(users.getUserProfile));
router.get('/users/:id/posts', validate({ ...byId, ...page }), h(users.userPosts));

const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get('/users', validate(page), h(admin.listUsers));
adminRouter.post('/users', validate({ body: v.adminCreateUserBody }), h(admin.createUser));
adminRouter.get('/users/:id', validate(byId), h(admin.getUser));
adminRouter.patch('/users/:id', validate({ ...byId, body: v.adminUpdateUserBody }), h(admin.updateUser));
adminRouter.delete('/users/:id', validate(byId), h(admin.deleteUser));
adminRouter.get('/notes', validate({ query: v.adminNotesQuery }), h(admin.listAllNotes));
router.use('/admin', adminRouter);

export default router;
