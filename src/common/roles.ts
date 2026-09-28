export enum Role {
  User = 'user',
  Admin = 'admin',
}

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}
