import { User } from '../models/User.js';
import { notFound } from '../utils/httpError.js';
import { parsePagination } from '../utils/pagination.js';
import { usersByInterestPipeline, userPostsPipeline } from '../services/aggregations.js';

export async function getUserProfile(req, res) {
  const user = await User.findById(req.valid.params.id, { name: 1, interests: 1, createdAt: 1 }).lean();
  if (!user) throw notFound('User');
  res.json(user);
}

export async function usersByInterest(req, res) {
  const pagination = parsePagination(req.valid.query);
  const pipeline = usersByInterestPipeline({ ...pagination, interest: req.valid.query.interest });
  const [{ items, total }] = await User.aggregate(pipeline);
  res.json({ items, page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) });
}

export async function userPosts(req, res) {
  const pagination = parsePagination(req.valid.query);
  const [result] = await User.aggregate(userPostsPipeline({ ...pagination, userId: req.valid.params.id }));
  if (!result) throw notFound('User');
  res.json({
    author: result.author,
    items: result.posts,
    page: pagination.page,
    limit: pagination.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / pagination.limit),
  });
}
