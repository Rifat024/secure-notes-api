import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../common/roles';

export class UserResponse {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.User })
  role: Role;

  @ApiProperty({ type: [String], example: ['chess', 'reading'] })
  interests: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PublicProfileResponse {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;

  @ApiProperty({ type: [String], example: ['chess', 'reading'] })
  interests: string[];

  @ApiProperty()
  createdAt: Date;
}

export class AuthResponse {
  @ApiProperty({ description: 'HS256 JWT; send as `Authorization: Bearer <token>`' })
  token: string;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}

export class ProfileUpdateResponse {
  @ApiPropertyOptional({ description: 'Present only after a password change, which revokes every other session' })
  token?: string;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}

export class UserSummary {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;
}

export class InterestGroupResponse {
  @ApiProperty({ example: 'chess' })
  interest: string;

  @ApiProperty({ example: 3 })
  count: number;

  @ApiProperty({ type: [UserSummary] })
  users: UserSummary[];
}
