import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CloseReason, Role, TicketStatus } from '../../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../../shared/auth/jwt-payload.type.js';

export interface TicketLifecycleContext {
  status: TicketStatus;
  reporterId: string;
  assigneeId: string | null;
}

export function assertTicketStatusTransition(
  ticket: TicketLifecycleContext,
  targetStatus: TicketStatus,
  actor: AuthenticatedUser,
  closeReason?: CloseReason,
): void {
  if (ticket.status === TicketStatus.CLOSED) {
    throw new BadRequestException('Closed tickets cannot be reopened; submit a new ticket');
  }

  if (targetStatus === TicketStatus.CLOSED) {
    if (actor.role !== Role.ADMIN && !(actor.role === Role.USER && actor.id === ticket.reporterId)) {
      throw new ForbiddenException('Only the ticket owner or an admin can close this ticket');
    }
    if (!closeReason) throw new BadRequestException('closeReason is required when closing a ticket');
    return;
  }

  if (ticket.status === TicketStatus.RESOLVED && targetStatus === TicketStatus.OPEN) {
    if (actor.role !== Role.ADMIN && !(actor.role === Role.USER && actor.id === ticket.reporterId)) {
      throw new ForbiddenException('Only the ticket owner or an admin can reopen this ticket');
    }
    return;
  }

  const agentMayAdvance =
    actor.role === Role.ADMIN || (actor.role === Role.AGENT && actor.id === ticket.assigneeId);
  const validAgentTransition =
    (ticket.status === TicketStatus.OPEN && targetStatus === TicketStatus.IN_PROGRESS) ||
    (ticket.status === TicketStatus.IN_PROGRESS && targetStatus === TicketStatus.PENDING_USER_RESPONSE) ||
    ((ticket.status === TicketStatus.IN_PROGRESS ||
      ticket.status === TicketStatus.PENDING_USER_RESPONSE) &&
      targetStatus === TicketStatus.RESOLVED);

  if (!validAgentTransition) {
    throw new BadRequestException(
      `Invalid ticket status transition from ${ticket.status} to ${targetStatus}`,
    );
  }
  if (!agentMayAdvance) {
    throw new ForbiddenException('Only the assigned agent or an admin can make this transition');
  }
}

export function assertCanViewTicket(actor: AuthenticatedUser, reporterId: string): void {
  if (actor.role === Role.USER && actor.id !== reporterId) {
    throw new ForbiddenException('You can only view your own tickets');
  }
}

export function assertCanCommentOnTicket(actor: AuthenticatedUser, reporterId: string): void {
  if (actor.role === Role.USER && actor.id !== reporterId) {
    throw new ForbiddenException('You can only comment on your own tickets');
  }
}