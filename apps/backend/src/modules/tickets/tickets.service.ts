import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CloseReason,
  Role,
  TicketStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt-payload.type.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { selectAgent } from './domain/agent-assignment.js';
import {
  assertCanCommentOnTicket,
  assertCanViewTicket,
  assertTicketStatusTransition,
} from './domain/ticket-lifecycle.js';
import type {
  AssignTicketDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto.js';

const WORKLOAD_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING_USER_RESPONSE,
] as const;

const BASIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateTicketDto, actor: AuthenticatedUser) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const department = await transaction.department.findUnique({
        where: { id: dto.departmentId },
        select: { id: true, name: true },
      });
      if (!department) throw new NotFoundException('Department not found');

      const agents = await transaction.user.findMany({
        where: { role: Role.AGENT, status: UserStatus.ACTIVE },
        select: {
          ...BASIC_USER_SELECT,
          createdAt: true,
          _count: {
            select: {
              assignedTickets: { where: { status: { in: [...WORKLOAD_STATUSES] } } },
            },
          },
          assignedTickets: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });
      const assignee = selectAgent(
        agents.map((agent) => ({
          ...agent,
          workload: agent._count.assignedTickets,
          lastAssignedAt: agent.assignedTickets[0]?.createdAt ?? null,
        })),
      );

      const ticket = await transaction.ticket.create({
        data: {
          title: dto.title,
          description: dto.description,
          departmentId: department.id,
          reporterId: actor.id,
          status: TicketStatus.OPEN,
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(assignee ? { assigneeId: assignee.id } : {}),
        },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          reporter: { select: BASIC_USER_SELECT },
          assignee: { select: BASIC_USER_SELECT },
        },
      });
      return { ticket, departmentName: department.name };
    });

    const reporterName = `${result.ticket.reporter.firstName} ${result.ticket.reporter.lastName}`;
    await this.mail.sendTicketCreated({
      to: result.ticket.reporter.email,
      ticketNumber: result.ticket.ticketNumber,
      title: result.ticket.title,
      status: result.ticket.status,
      ticketId: result.ticket.id,
    });

    if (result.ticket.assignee) {
      await this.mail.sendTicketAssigned({
        to: result.ticket.assignee.email,
        ticketNumber: result.ticket.ticketNumber,
        reporterName,
        priority: result.ticket.priority,
        ticketId: result.ticket.id,
      });
    } else {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
        select: { email: true },
      });
      if (admins.length > 0) {
        await this.mail.sendUnassignedTicketAlert({
          to: admins.map((admin) => admin.email),
          ticketNumber: result.ticket.ticketNumber,
          reporterName,
          departmentName: result.departmentName,
          ticketId: result.ticket.id,
        });
      }
    }
    return result.ticket;
  }

  async findAll(query: ListTicketsQueryDto, actor: AuthenticatedUser) {
    const where = {
      ...(actor.role === Role.USER ? { reporterId: actor.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          reporterId: true,
          assignee: { select: BASIC_USER_SELECT },
          department: { select: { id: true, name: true } },
          lastActivityAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        closeReason: true,
        reporterId: true,
        assigneeId: true,
        reporter: { select: BASIC_USER_SELECT },
        assignee: { select: BASIC_USER_SELECT },
        department: { select: { id: true, name: true, description: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            ticketId: true,
            authorId: true,
            createdAt: true,
            author: { select: BASIC_USER_SELECT },
          },
        },
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    assertCanViewTicket(actor, ticket.reporterId);
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto, actor: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        reporterId: true,
        assigneeId: true,
        reporter: { select: { email: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    assertTicketStatusTransition(ticket, dto.status, actor, dto.closeReason);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        lastActivityAt: new Date(),
        ...(dto.status === TicketStatus.CLOSED
          ? { closeReason: dto.closeReason }
          : dto.status === TicketStatus.OPEN
            ? { closeReason: null }
            : {}),
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        closeReason: true,
        lastActivityAt: true,
        updatedAt: true,
      },
    });

    if (dto.status === TicketStatus.RESOLVED) {
      await this.mail.sendTicketResolved({
        to: ticket.reporter.email,
        ticketNumber: ticket.ticketNumber,
        details: dto.resolutionNote ?? 'Your ticket has been resolved.',
        ticketId: ticket.id,
      });
    } else if (dto.status === TicketStatus.CLOSED) {
      await this.mail.sendTicketClosed({
        to: ticket.reporter.email,
        ticketNumber: ticket.ticketNumber,
        closeReason: dto.closeReason as CloseReason,
        ticketId: ticket.id,
      });
    }
    return updated;
  }

  async assign(id: string, dto: AssignTicketDto) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
      select: { id: true, role: true, status: true, email: true },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');
    if (assignee.role !== Role.AGENT || assignee.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Assignee must be an active agent');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        priority: true,
        reporter: { select: { firstName: true, lastName: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Closed tickets cannot be assigned');
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { assigneeId: assignee.id, lastActivityAt: new Date() },
      select: {
        id: true,
        ticketNumber: true,
        assigneeId: true,
        lastActivityAt: true,
        updatedAt: true,
      },
    });
    await this.mail.sendTicketAssigned({
      to: assignee.email,
      ticketNumber: ticket.ticketNumber,
      reporterName: `${ticket.reporter.firstName} ${ticket.reporter.lastName}`,
      priority: ticket.priority,
      ticketId: ticket.id,
    });
    return updated;
  }

  async addComment(id: string, dto: CreateTicketCommentDto, actor: AuthenticatedUser) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { id },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          reporterId: true,
          assigneeId: true,
          reporter: { select: { email: true } },
          assignee: { select: { email: true } },
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      assertCanCommentOnTicket(actor, ticket.reporterId);
      if (ticket.status === TicketStatus.CLOSED) {
        throw new BadRequestException('Closed tickets cannot receive comments');
      }

      const now = new Date();
      const comment = await transaction.ticketComment.create({
        data: { content: dto.content, ticketId: id, authorId: actor.id },
        select: {
          id: true,
          content: true,
          ticketId: true,
          authorId: true,
          createdAt: true,
          author: { select: BASIC_USER_SELECT },
        },
      });
      await transaction.ticket.update({ where: { id }, data: { lastActivityAt: now } });
      return { comment, ticket };
    });

    const snippet = dto.content.slice(0, 140);
    if (actor.role === Role.AGENT || actor.role === Role.ADMIN) {
      if (actor.id !== result.ticket.reporterId) {
        await this.mail.sendNewCommentByAgent({
          to: result.ticket.reporter.email,
          ticketNumber: result.ticket.ticketNumber,
          snippet,
          ticketId: result.ticket.id,
        });
      }
    } else if (result.ticket.assignee) {
      await this.mail.sendNewCommentByUser({
        to: result.ticket.assignee.email,
        ticketNumber: result.ticket.ticketNumber,
        snippet,
        ticketId: result.ticket.id,
      });
    }
    return result.comment;
  }
}