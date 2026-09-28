import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { SECURITY } from '../config/security.config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/roles';
import { clientIp } from '../common/utils/client-ip';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { rethrow } from '../common/utils/rethrow';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle({ default: SECURITY.registerRateLimit })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await this.auth.register(dto);
    } catch (error) {
      rethrow(error, 'AuthController.register');
    }
  }

  @Public()
  @Throttle({ default: SECURITY.authRateLimit })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    try {
      return await this.auth.login(dto, clientIp(req));
    } catch (error) {
      rethrow(error, 'AuthController.login');
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    try {
      return await this.auth.logout(user.id);
    } catch (error) {
      rethrow(error, 'AuthController.logout');
    }
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    try {
      return await this.users.findById(user.id);
    } catch (error) {
      rethrow(error, 'AuthController.me');
    }
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    try {
      return await this.auth.updateProfile(user.id, dto);
    } catch (error) {
      rethrow(error, 'AuthController.updateMe');
    }
  }
}
