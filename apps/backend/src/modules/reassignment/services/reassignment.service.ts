import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ReassignmentStatus,
  Role,
  TicketStatus,
  UserStatus,
} from '../../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../../shared/auth/jwt-payload.type.js';
import { MailService } from '../../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { CreateReassignmentRequestDto } from '../dtos/create-reassignment-request.dto.js';
import { ReviewReassignmentRequestDto } from '../dtos/review-reassignment-request.dto.js';

@Injectable()
export class ReassignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createRequest(
    ticketId: string,
    requester: AuthenticatedUser,
    dto: CreateReassignmentRequestDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketNumber: true, status: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Closed tickets cannot be reassigned');
    }
    if (ticket.assigneeId !== requester.id) {
      throw new ForbiddenException('Only the current assignee can request reassignment');
    }
    if (dto.targetAgentId === requester.id) {
      throw new BadRequestException('The target agent must be different from the requester');
    }
    if (dto.targetAgentId) await this.#findActiveAgent(dto.targetAgentId);

    const existingRequest = await this.prisma.reassignmentRequest.findFirst({
      where: {
        ticketId,
        requesterId: requester.id,
        status: ReassignmentStatus.PENDING,
      },
      select: { id: true },
    });
    if (existingRequest) {
      throw new ConflictException('A pending reassignment request already exists');
    }

    const requesterDetails = await this.prisma.user.findUnique({
      where: { id: requester.id },
      select: { firstName: true, lastName: true },
    });
    if (!requesterDetails) throw new NotFoundException('Requesting agent not found');

    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { email: true },
    });
    const createdRequest = await this.prisma.reassignmentRequest.create({
      data: {
        ticketId,
        requesterId: requester.id,
        targetAgentId: dto.targetAgentId,
        reason: dto.reason,
        status: ReassignmentStatus.PENDING,
      },
    });

    await this.mailService.sendReassignmentRequested({
      to: admins.map(({ email }) => email),
      ticketNumber: ticket.ticketNumber,
      requesterName: `${requesterDetails.firstName} ${requesterDetails.lastName}`,
      reason: dto.reason,
    });

    return createdRequest;
  }

  async listRequests(status?: ReassignmentStatus) {
    const requests = await this.prisma.reassignmentRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { id: true, ticketNumber: true, title: true, status: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const targetAgentIds = [
      ...new Set(
        requests.flatMap(({ targetAgentId }) => (targetAgentId ? [targetAgentId] : [])),
      ),
    ];
    const targetAgents = targetAgentIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: targetAgentIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const targetAgentsById = new Map(targetAgents.map((agent) => [agent.id, agent]));

    return requests.map((request) => ({
      ...request,
      targetAgent: request.targetAgentId
        ? (targetAgentsById.get(request.targetAgentId) ?? null)
        : null,
    }));
  }

  async reviewRequest(id: string, dto: ReviewReassignmentRequestDto) {
    const request = await this.prisma.reassignmentRequest.findUnique({
      where: { id },
      select: {
        id: true,
        ticketId: true,
        targetAgentId: true,
        status: true,
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            priority: true,
            reporter: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Reassignment request not found');
    if (request.status !== ReassignmentStatus.PENDING) {
      throw new ConflictException('Reassignment request has already been resolved');
    }

    if (dto.action === 'REJECT') {
      const update = await this.prisma.reassignmentRequest.updateMany({
        where: { id, status: ReassignmentStatus.PENDING },
        data: { status: ReassignmentStatus.REJECTED },
      });
      if (update.count !== 1) {
        throw new ConflictException('Reassignment request has already been resolved');
      }
      const updatedRequest = await this.prisma.reassignmentRequest.findUnique({ where: { id } });
      if (!updatedRequest) throw new NotFoundException('Reassignment request not found');
      return updatedRequest;
    }

    const assigneeId = dto.assigneeId ?? request.targetAgentId;
    if (!assigneeId) throw new BadRequestException('A target agent is required to approve');
    const targetAgent = await this.#findActiveAgent(assigneeId);

    const updatedRequest = await this.prisma.$transaction(async (transaction) => {
      const requestUpdate = await transaction.reassignmentRequest.updateMany({
        where: { id, status: ReassignmentStatus.PENDING },
        data: { status: ReassignmentStatus.APPROVED },
      });
      if (requestUpdate.count !== 1) {
        throw new ConflictException('Reassignment request has already been resolved');
      }

      const ticketUpdate = await transaction.ticket.updateMany({
        where: { id: request.ticketId, status: { not: TicketStatus.CLOSED } },
        data: { assigneeId: targetAgent.id, lastActivityAt: new Date() },
      });
      if (ticketUpdate.count !== 1) {
        throw new BadRequestException('Closed tickets cannot be reassigned');
      }

      return transaction.reassignmentRequest.findUnique({ where: { id } });
    });
    if (!updatedRequest) throw new NotFoundException('Reassignment request not found');

    await this.mailService.sendTicketAssigned({
      to: targetAgent.email,
      ticketNumber: request.ticket.ticketNumber,
      reporterName: `${request.ticket.reporter.firstName} ${request.ticket.reporter.lastName}`,
      priority: request.ticket.priority,
      ticketId: request.ticket.id,
    });

    return updatedRequest;
  }

  async #findActiveAgent(id: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id, role: Role.AGENT, status: UserStatus.ACTIVE },
      select: { id: true, email: true },
    });
    if (!agent) throw new BadRequestException('Target must be an active agent');
    return agent;
  }
}