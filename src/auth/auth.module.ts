import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/app.config.js';
import { SECURITY } from '../config/security.config.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginGuardService } from './login-guard.service.js';
import { LoginThrottleRepository } from './login-throttle.repository.js';
import { LoginThrottle, LoginThrottleSchema } from './schemas/login-throttle.schema.js';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: LoginThrottle.name, schema: LoginThrottleSchema }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.getOrThrow<AppConfig>('app');
        return {
          secret: app.jwtSecret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: app.jwtExpiresIn as unknown as number,
            issuer: SECURITY.jwtIssuer,
            audience: SECURITY.jwtAudience,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginGuardService, LoginThrottleRepository],
})
export class AuthModule {}
