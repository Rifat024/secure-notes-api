import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    interests: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
      default: [],
    },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    // Incremented to revoke every token issued before it (logout, password or role change).
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ interests: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.tokenVersion;
    return ret;
  },
});

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export const User = mongoose.model('User', userSchema);
