import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt-payload.type.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsService permissions', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const user: AuthenticatedUser = { id: 'user-1', email: 'user@example.com', role: Role.USER };
  const otherUser: AuthenticatedUser = { id: 'user-2', email: 'other@example.com', role: Role.USER };

  beforeEach(async () => {
    prisma = {
      ticket: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const mail = {
      sendNewCommentByAgent: vi.fn().mockResolvedValue(undefined),
      sendNewCommentByUser: vi.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(TicketsService);
  });

  it('limits a user list query to their own reporter id', async () => {
    await service.findAll({ page: 1, pageSize: 20 }, user);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reporterId: user.id }) }),
    );
  });

  it('forbids a user from reading another reporter ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ reporterId: otherUser.id });

    await expect(service.findOne('ticket-id', user)).rejects.toThrow(ForbiddenException);
  });

  it('allows a user to read their own ticket', async () => {
    const ticket = { reporterId: user.id };
    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(service.findOne('ticket-id', user)).resolves.toBe(ticket);
  });

  it('allows agents and admins to list all tickets without an owner filter', async () => {
    const agent: AuthenticatedUser = { id: 'agent', email: 'agent@example.com', role: Role.AGENT };
    await service.findAll({ page: 1, pageSize: 20 }, agent);

    const [query] = prisma.ticket.findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(query.where).not.toHaveProperty('reporterId');
  });

  it('forbids a user from commenting on another reporter ticket', async () => {
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue({ reporterId: otherUser.id }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.addComment('ticket-id', { content: 'A reply' }, user),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows the ticket owner to comment on their own ticket', async () => {
    const comment = { id: 'comment-1', content: 'A reply' };
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ticket-id',
          ticketNumber: 1,
          status: 'OPEN',
          reporterId: user.id,
          assigneeId: null,
          reporter: { email: user.email },
          assignee: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      ticketComment: { create: vi.fn().mockResolvedValue(comment) },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.addComment('ticket-id', { content: 'A reply' }, user)).resolves.toBe(comment);
  });
});