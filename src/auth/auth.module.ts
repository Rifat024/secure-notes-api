import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/app.config';
import { SECURITY } from '../config/security.config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginGuardService } from './login-guard.service';
import { LoginThrottleRepository } from './login-throttle.repository';
import { LoginThrottle, LoginThrottleSchema } from './schemas/login-throttle.schema';

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
