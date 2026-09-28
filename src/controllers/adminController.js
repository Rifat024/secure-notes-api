import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { HttpError, notFound } from '../utils/httpError.js';
import { paginateFind } from '../utils/pagination.js';

export async function listUsers(req, res) {
  res.json(await paginateFind(User, {}, req.valid.query));
}

export async function getUser(req, res) {
  const user = await User.findById(req.valid.params.id).lean();
  if (!user) throw notFound('User');
  res.json(user);
}

export async function createUser(req, res) {
  const user = await User.create(req.valid.body);
  res.status(201).json(user.toJSON());
}

export async function updateUser(req, res) {
  const { id } = req.valid.params;
  if (id === req.user.id && req.valid.body.role && req.valid.body.role !== req.user.role) {
    throw new HttpError(400, 'Admins cannot change their own role');
  }
  const user = await User.findById(id);
  if (!user) throw notFound('User');
  Object.assign(user, req.valid.body);
  await user.save();
  res.json(user.toJSON());
}

export async function deleteUser(req, res) {
  const { id } = req.valid.params;
  if (id === req.user.id) throw new HttpError(400, 'Admins cannot delete their own account');
  const owner = new mongoose.Types.ObjectId(id);
  const { deletedCount } = await User.deleteOne({ _id: owner });
  if (!deletedCount) throw notFound('User');
  await Promise.all([Note.deleteMany({ owner }), Post.deleteMany({ author: owner })]);
  res.status(204).end();
}

export async function listAllNotes(req, res) {
  const { owner } = req.valid.query;
  res.json(
    await paginateFind(Note, owner ? { owner } : {}, req.valid.query, {
      populate: { path: 'owner', select: 'name email' },
    }),
  );
}
