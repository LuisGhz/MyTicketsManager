import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const PROFILE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: AppConfigService,
  ) {}

  async createAdminUser(dto: CreateAdminUserDto) {
    if (dto.role !== Role.USER && dto.role !== Role.AGENT) {
      throw new BadRequestException('Role must be USER or AGENT');
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    let createdUser;

    try {
      createdUser = await this.prisma.user.create({
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          status: UserStatus.PENDING_VERIFICATION,
          verificationToken: token,
          verificationTokenExpiry: expiresAt,
        },
        select: PROFILE_SELECT,
      });
    } catch (error: unknown) {
      if (this.#isUniqueConstraintError(error)) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }

    await this.mailService.sendAccountInvitation({
      to: email,
      firstName: dto.firstName,
      verifyUrl: `${this.config.appUrl.replace(/\/+$/, '')}/verify-account?token=${token}`,
      expiresAt,
    });

    return createdUser;
  }

  #isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}