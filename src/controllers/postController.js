import { Post } from '../models/Post.js';
import { ROLES } from '../models/User.js';
import { notFound } from '../utils/httpError.js';
import { paginateFind } from '../utils/pagination.js';

const AUTHOR = { path: 'author', select: 'name' };

export async function listPosts(req, res) {
  res.json(await paginateFind(Post, {}, req.valid.query, { populate: AUTHOR }));
}

export async function createPost(req, res) {
  const post = await Post.create({ ...req.valid.body, author: req.user.id });
  res.status(201).json(post);
}

export async function getPost(req, res) {
  const post = await Post.findById(req.valid.params.id).populate(AUTHOR).lean();
  if (!post) throw notFound('Post');
  res.json(post);
}

export async function deletePost(req, res) {
  const filter = { _id: req.valid.params.id };
  if (req.user.role !== ROLES.ADMIN) filter.author = req.user.id;
  const { deletedCount } = await Post.deleteOne(filter);
  if (!deletedCount) throw notFound('Post');
  res.status(204).end();
}
