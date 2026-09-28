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
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator';
import { AuthResponse, ProfileUpdateResponse, UserResponse } from '../users/dto/user.response';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @ApiOperation({ summary: 'Create an account', description: 'Always creates a regular user; roles cannot be self-assigned. Limited to 10 registrations per hour per IP.' })
  @ApiCreatedResponse({ type: AuthResponse })
  @ApiErrors(400, 409, 429)
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

  @ApiOperation({
    summary: 'Sign in',
    description:
      'Returns a JWT valid for 8 hours. 5 wrong passwords lock the account for 15 minutes; 10 failures from one IP block it for 30 minutes. Both return 429 with Retry-After.',
  })
  @ApiOkResponse({ type: AuthResponse })
  @ApiErrors(400, 401, 429)
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

  @ApiOperation({ summary: 'Sign out everywhere', description: 'Revokes every token issued to the caller.' })
  @ApiBearerAuth('jwt')
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  @ApiErrors(401)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    try {
      return await this.auth.logout(user.id);
    } catch (error) {
      rethrow(error, 'AuthController.logout');
    }
  }

  @ApiOperation({ summary: 'Current user profile' })
  @ApiBearerAuth('jwt')
  @ApiOkResponse({ type: UserResponse })
  @ApiErrors(401)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    try {
      return await this.users.findById(user.id);
    } catch (error) {
      rethrow(error, 'AuthController.me');
    }
  }

  @ApiOperation({ summary: 'Update own profile', description: 'Changing the password revokes other sessions and returns a fresh token.' })
  @ApiBearerAuth('jwt')
  @ApiOkResponse({ type: ProfileUpdateResponse })
  @ApiErrors(400, 401)
  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    try {
      return await this.auth.updateProfile(user.id, dto);
    } catch (error) {
      rethrow(error, 'AuthController.updateMe');
    }
  }
}
