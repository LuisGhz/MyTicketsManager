import type { Role } from '../../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};