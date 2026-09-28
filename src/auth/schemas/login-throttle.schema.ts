import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Failed sign-in counter per client IP. The IP is the _id, so every read and update uses the
 * built-in _id index and no secondary index is needed.
 */
@Schema({ versionKey: false, collection: 'loginthrottles' })
export class LoginThrottle {
  @Prop({ type: String })
  _id: string;

  @Prop({ default: 0 })
  failures: number;

  @Prop()
  windowStartedAt?: Date;

  @Prop()
  blockedUntil?: Date;
}

export const LoginThrottleSchema = SchemaFactory.createForClass(LoginThrottle);
