import mongoose from 'mongoose';

/**
 * Failed sign-in counter per client IP. The IP is the _id, so every read and update uses the
 * built-in _id index and no secondary index is needed.
 */
const loginThrottleSchema = new mongoose.Schema(
  {
    _id: { type: String },
    failures: { type: Number, default: 0 },
    windowStartedAt: { type: Date },
    blockedUntil: { type: Date },
  },
  { versionKey: false },
);

export const LoginThrottle = mongoose.model('LoginThrottle', loginThrottleSchema);
