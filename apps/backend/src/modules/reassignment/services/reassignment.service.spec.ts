import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  ReassignmentStatus,
  Role,
  TicketStatus,
  UserStatus,
} from '../../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../../shared/auth/jwt-payload.type.js';
import { MailService } from '../../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { ReassignmentService } from './reassignment.service.js';

describe('ReassignmentService', () => {
  const requester: AuthenticatedUser = {
    id: 'agent-1',
    email: 'agent1@example.com',
    role: Role.AGENT,
  };
  const openAssignedTicket = {
    id: 'ticket-1',
    ticketNumber: 42,
    status: TicketStatus.OPEN,
    assigneeId: requester.id,
  };
  const pendingRequest = {
    id: 'request-1',
    ticketId: 'ticket-1',
    targetAgentId: 'agent-2',
    status: ReassignmentStatus.PENDING,
    ticket: {
      id: 'ticket-1',
      ticketNumber: 42,
      status: TicketStatus.OPEN,
      priority: 'HIGH',
      reporter: { firstName: 'Taylor', lastName: 'Reporter' },
    },
  };

  const transactionMock = {
    reassignmentRequest: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    ticket: { updateMany: vi.fn() },
  };
  const runTransaction = async (
    operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<unknown> => operation(transactionMock as unknown as Prisma.TransactionClient);
  const prismaMock = {
    ticket: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    reassignmentRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(runTransaction),
  };
  const mailMock = {
    sendReassignmentRequested: vi.fn(),
    sendTicketAssigned: vi.fn(),
  };

  let service: ReassignmentService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReassignmentService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();
    service = module.get<ReassignmentService>(ReassignmentService);
  });

  it('rejects a request from an agent who is not the ticket assignee', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ ...openAssignedTicket, assigneeId: 'agent-3' });

    await expect(
      service.createRequest('ticket-1', requester, { reason: 'Workload' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a request for a closed ticket', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      ...openAssignedTicket,
      status: TicketStatus.CLOSED,
    });

    await expect(
      service.createRequest('ticket-1', requester, { reason: 'Workload' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate pending request by the same agent', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(openAssignedTicket);
    prismaMock.reassignmentRequest.findFirst.mockResolvedValue({ id: 'existing-request' });

    await expect(
      service.createRequest('ticket-1', requester, { reason: 'Workload' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the request and notifies active admins', async () => {
    const createdRequest = { id: 'request-2', status: ReassignmentStatus.PENDING };
    prismaMock.ticket.findUnique.mockResolvedValue(openAssignedTicket);
    prismaMock.reassignmentRequest.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ firstName: 'Avery', lastName: 'Agent' });
    prismaMock.user.findMany.mockResolvedValue([{ email: 'admin@example.com' }]);
    prismaMock.reassignmentRequest.create.mockResolvedValue(createdRequest);

    await expect(
      service.createRequest('ticket-1', requester, { reason: 'Workload' }),
    ).resolves.toBe(createdRequest);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { email: true },
    });
    expect(mailMock.sendReassignmentRequested).toHaveBeenCalledWith({
      to: ['admin@example.com'],
      ticketNumber: 42,
      requesterName: 'Avery Agent',
      reason: 'Workload',
    });
  });

  it('approves atomically, assigns the request target, and notifies that agent', async () => {
    const approvedRequest = { id: 'request-1', status: ReassignmentStatus.APPROVED };
    prismaMock.reassignmentRequest.findUnique.mockResolvedValue(pendingRequest);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'agent-2', email: 'agent2@example.com' });
    transactionMock.reassignmentRequest.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.ticket.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.reassignmentRequest.findUnique.mockResolvedValue(approvedRequest);

    await expect(
      service.reviewRequest('request-1', { action: 'APPROVE' }),
    ).resolves.toBe(approvedRequest);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(transactionMock.reassignmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: ReassignmentStatus.PENDING },
      data: { status: ReassignmentStatus.APPROVED },
    });
    expect(transactionMock.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', status: { not: TicketStatus.CLOSED } },
      data: expect.objectContaining({ assigneeId: 'agent-2', lastActivityAt: expect.any(Date) }),
    });
    expect(mailMock.sendTicketAssigned).toHaveBeenCalledWith({
      to: 'agent2@example.com',
      ticketNumber: 42,
      reporterName: 'Taylor Reporter',
      priority: 'HIGH',
      ticketId: 'ticket-1',
    });
  });

  it('requires a target agent to approve', async () => {
    prismaMock.reassignmentRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      targetAgentId: null,
    });

    await expect(
      service.reviewRequest('request-1', { action: 'APPROVE' }),
    ).rejects.toThrow('A target agent is required to approve');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a pending request', async () => {
    const rejectedRequest = { id: 'request-1', status: ReassignmentStatus.REJECTED };
    prismaMock.reassignmentRequest.findUnique
      .mockResolvedValueOnce(pendingRequest)
      .mockResolvedValueOnce(rejectedRequest);
    prismaMock.reassignmentRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.reviewRequest('request-1', { action: 'REJECT' }),
    ).resolves.toBe(rejectedRequest);
    expect(prismaMock.reassignmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: ReassignmentStatus.PENDING },
      data: { status: ReassignmentStatus.REJECTED },
    });
  });

  it('returns conflict for an already-resolved request', async () => {
    prismaMock.reassignmentRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: ReassignmentStatus.APPROVED,
    });

    await expect(
      service.reviewRequest('request-1', { action: 'REJECT' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});