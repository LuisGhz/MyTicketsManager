import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppConfigService } from '../../config/app-config.service.js';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { UsersService } from './users.service.js';
import { vi } from 'vitest';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const mailService = { sendAccountInvitation: vi.fn() };
  const config = { appUrl: 'https://tickets.example.com/' };
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: AppConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('creates an invited user and sends the verification email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      role: Role.AGENT,
      status: UserStatus.PENDING_VERIFICATION,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createAdminUser({
      email: ' New@Example.com ',
      firstName: 'New',
      lastName: 'User',
      role: Role.AGENT,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          role: Role.AGENT,
          status: UserStatus.PENDING_VERIFICATION,
          verificationToken: expect.stringMatching(/^[a-f0-9]{64}$/),
          verificationTokenExpiry: expect.any(Date),
        }),
      }),
    );
    expect(mailService.sendAccountInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        firstName: 'New',
        verifyUrl: expect.stringMatching(
          /^https:\/\/tickets\.example\.com\/verify-account\?token=[a-f0-9]{64}$/,
        ),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('rejects provisioning an ADMIN role', async () => {
    await expect(
      service.createAdminUser({
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.createAdminUser({
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        role: Role.USER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});