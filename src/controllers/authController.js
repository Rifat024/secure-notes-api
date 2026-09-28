import bcrypt from 'bcryptjs';
import { User, ROLES } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { clientIp } from '../utils/clientIp.js';
import { securityLog } from '../utils/securityLog.js';
import { assertIpAllowed, lockedError, recordAccountFailure, recordIpFailure, resetAccountFailures } from '../services/loginGuard.js';

// Compared against when the email is unknown so response time does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 12);

const authResponse = (user) => ({ token: signToken(user), user: user.toJSON() });

export async function register(req, res) {
  const user = await User.create({ ...req.valid.body, role: ROLES.USER });
  res.status(201).json(authResponse(user));
}

export async function login(req, res) {
  const ip = clientIp(req);
  await assertIpAllowed(ip);

  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil +tokenVersion');

  if (user?.lockUntil && user.lockUntil > new Date()) {
    await recordIpFailure(ip);
    throw lockedError(user.lockUntil);
  }

  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) {
    await Promise.all([recordIpFailure(ip), user && recordAccountFailure(user._id)]);
    securityLog('login_failed', { ip, email });
    throw new HttpError(401, 'Invalid email or password');
  }

  await resetAccountFailures(user);
  res.json(authResponse(user));
}

export async function logout(req, res) {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.status(204).end();
}

export async function me(req, res) {
  const user = await User.findById(req.user.id).lean();
  res.json(user);
}

export async function updateMe(req, res) {
  const user = await User.findById(req.user.id).select('+tokenVersion');
  Object.assign(user, req.valid.body);
  // A password change signs out every other session; the caller receives a fresh token.
  if (req.valid.body.password) user.tokenVersion += 1;
  await user.save();
  res.json(req.valid.body.password ? authResponse(user) : { user: user.toJSON() });
}
