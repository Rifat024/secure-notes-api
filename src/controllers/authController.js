import bcrypt from 'bcryptjs';
import { User, ROLES } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';

// Compared against when the email is unknown so response time does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 12);

const authResponse = (user) => ({ token: signToken(user), user: user.toJSON() });

export async function register(req, res) {
  const user = await User.create({ ...req.valid.body, role: ROLES.USER });
  res.status(201).json(authResponse(user));
}

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+password');
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
  res.json(authResponse(user));
}

export async function me(req, res) {
  const user = await User.findById(req.user.id).lean();
  res.json(user);
}

export async function updateMe(req, res) {
  const user = await User.findById(req.user.id);
  Object.assign(user, req.valid.body);
  await user.save();
  res.json(user.toJSON());
}
