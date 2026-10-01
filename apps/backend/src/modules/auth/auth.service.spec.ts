import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import { vi } from 'vitest';

describe('AuthService', () => {
  const createPrismaMock = () => {
    const transaction = {
      user: { count: vi.fn(), create: vi.fn() },
    };
    return {
      user: {
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(
        async (
          operation: (tx: typeof transaction) => Promise<unknown>,
          _options?: { isolationLevel: string },
        ) => operation(transaction),
      ),
      transaction,
    };
  };

  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  const jwt = { signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('allows initial setup when there are no users', async () => {
    prisma.user.count.mockResolvedValue(0);

    await expect(service.getSetupStatus()).resolves.toEqual({
      isSetupAllowed: true,
    });
  });

  it('locks setup when a user already exists', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.transaction.user.count.mockResolvedValue(1);

    try {
      await service.setup({
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'First',
        lastName: 'Last',
      });
      throw new Error('Expected setup to be locked');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);
      if (error instanceof ForbiddenException) {
        expect(error.getResponse()).toEqual({
          statusCode: 403,
          error: 'SETUP_ALREADY_COMPLETED',
          message: 'Initial setup has already been completed',
        });
      }
    }
  });

  it('creates the initial user as an active admin in a serializable transaction', async () => {
    const profile = {
      id: 'admin-1',
      email: 'admin@example.com',
      firstName: 'First',
      lastName: 'Last',
      role: 'ADMIN',
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.user.count.mockResolvedValue(0);
    prisma.transaction.user.count.mockResolvedValue(0);
    prisma.transaction.user.create.mockResolvedValue(profile);

    await expect(
      service.setup({
        email: ' Admin@Example.com ',
        password: 'password123',
        firstName: 'First',
        lastName: 'Last',
      }),
    ).resolves.toEqual(profile);
    expect(prisma.transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          role: 'ADMIN',
          status: UserStatus.ACTIVE,
          passwordHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.$transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: 'Serializable',
    });
  });

  it('rejects login while account verification is pending', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'First',
      lastName: 'Last',
      role: 'USER',
      status: UserStatus.PENDING_VERIFICATION,
      passwordHash: null,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toThrow(new UnauthorizedException('Account verification pending'));
  });

  it('rejects an expired verification token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      verificationTokenExpiry: new Date(Date.now() - 1),
    });

    await expect(
      service.verify({ token: 'expired-token', password: 'password123' }),
    ).rejects.toThrow('Verification token is invalid or expired');
  });
});