import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CallLoggingInterceptor } from './common/logging/call-logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { appConfig, validateEnv } from './config/app.config';
import { SECURITY } from './config/security.config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { NotesModule } from './notes/notes.module';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [appConfig], validate: validateEnv }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ...SECURITY.apiRateLimit }],
      errorMessage: 'Too many requests, please try again later',
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    NotesModule,
    PostsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: CallLoggingInterceptor },
  ],
})
export class AppModule {}
