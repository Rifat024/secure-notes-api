import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import type { HydratedDocument } from 'mongoose';
import { SECURITY } from '../../config/security.config.js';
import { Role } from '../../common/roles.js';

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.User })
  role: Role;

  @Prop({ type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] })
  interests: string[];

  @Prop({ default: 0, select: false })
  failedLoginAttempts: number;

  @Prop({ select: false })
  lockUntil?: Date;

  /** Incremented to revoke every token issued before it (logout, password or role change). */
  @Prop({ default: 0, select: false })
  tokenVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ interests: 1 });

UserSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SECURITY.bcryptRounds);
});

const HIDDEN_FIELDS = ['password', 'failedLoginAttempts', 'lockUntil', 'tokenVersion'] as const;

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    HIDDEN_FIELDS.forEach((field) => delete json[field]);
    return json;
  },
});

export const hashPassword = (plain: string) => bcrypt.hash(plain, SECURITY.bcryptRounds);
