import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client.js';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { LoginDto, SetupDto, VerifyAccountDto } from './dto/auth.dto.js';
import bcrypt from 'bcryptjs';

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
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
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getSetupStatus(): Promise<{ isSetupAllowed: boolean }> {
    return { isSetupAllowed: (await this.prisma.user.count()) === 0 };
  }

  async setup(dto: SetupDto) {
    if ((await this.prisma.user.count()) > 0) {
      throw this.#setupAlreadyCompleted();
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const email = dto.email.trim().toLowerCase();

    return this.prisma.$transaction(
      async (transaction) => {
        if ((await transaction.user.count()) > 0) {
          throw this.#setupAlreadyCompleted();
        }

        return transaction.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
          },
          select: PROFILE_SELECT,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        passwordHash: true,
      },
    });

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Account verification pending');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (user.status !== UserStatus.ACTIVE || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async verify(dto: VerifyAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: dto.token },
      select: { id: true, verificationTokenExpiry: true },
    });

    if (
      !user ||
      !user.verificationTokenExpiry ||
      user.verificationTokenExpiry <= new Date()
    ) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
      select: PROFILE_SELECT,
    });
  }

  register(): never {
    throw new ForbiddenException('Public registration is not allowed');
  }

  #setupAlreadyCompleted(): ForbiddenException {
    return new ForbiddenException({
      statusCode: 403,
      error: 'SETUP_ALREADY_COMPLETED',
      message: 'Initial setup has already been completed',
    });
  }
}