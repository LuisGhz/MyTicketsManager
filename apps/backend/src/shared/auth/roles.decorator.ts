import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums.js';
import { ROLES_KEY } from './auth.constants.js';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);