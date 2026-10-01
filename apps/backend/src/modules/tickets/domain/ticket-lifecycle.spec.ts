import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CloseReason, Role, TicketStatus } from '../../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../../shared/auth/jwt-payload.type.js';
import { assertTicketStatusTransition } from './ticket-lifecycle.js';

const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.com', role: Role.USER };
const assignedAgent: AuthenticatedUser = { id: 'agent', email: 'agent@example.com', role: Role.AGENT };
const otherAgent: AuthenticatedUser = { id: 'other', email: 'other@example.com', role: Role.AGENT };
const admin: AuthenticatedUser = { id: 'admin', email: 'admin@example.com', role: Role.ADMIN };

const ticket = (status: TicketStatus) => ({
  status,
  reporterId: owner.id,
  assigneeId: assignedAgent.id,
});

describe('assertTicketStatusTransition', () => {
  it.each([
    [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    [TicketStatus.IN_PROGRESS, TicketStatus.PENDING_USER_RESPONSE],
    [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.PENDING_USER_RESPONSE, TicketStatus.RESOLVED],
  ])('allows the assigned agent to move %s to %s', (from, to) => {
    expect(() => assertTicketStatusTransition(ticket(from), to, assignedAgent)).not.toThrow();
  });

  it.each([
    [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    [TicketStatus.IN_PROGRESS, TicketStatus.PENDING_USER_RESPONSE],
    [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.PENDING_USER_RESPONSE, TicketStatus.RESOLVED],
  ])('allows an admin to move %s to %s', (from, to) => {
    expect(() => assertTicketStatusTransition(ticket(from), to, admin)).not.toThrow();
  });

  it.each([
    [TicketStatus.OPEN, TicketStatus.PENDING_USER_RESPONSE],
    [TicketStatus.OPEN, TicketStatus.RESOLVED],
    [TicketStatus.IN_PROGRESS, TicketStatus.OPEN],
    [TicketStatus.PENDING_USER_RESPONSE, TicketStatus.IN_PROGRESS],
    [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS],
  ])('rejects invalid transition %s to %s', (from, to) => {
    expect(() => assertTicketStatusTransition(ticket(from), to, admin)).toThrow(
      BadRequestException,
    );
  });

  it('rejects unassigned or non-assignee agents', () => {
    expect(() => assertTicketStatusTransition(ticket(TicketStatus.OPEN), TicketStatus.IN_PROGRESS, otherAgent)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertTicketStatusTransition(
        { ...ticket(TicketStatus.OPEN), assigneeId: null },
        TicketStatus.IN_PROGRESS,
        assignedAgent,
      ),
    ).toThrow(ForbiddenException);
  });

  it('forbids the ticket owner from making agent-only progress transitions', () => {
    expect(() =>
      assertTicketStatusTransition(ticket(TicketStatus.OPEN), TicketStatus.IN_PROGRESS, owner),
    ).toThrow(ForbiddenException);
  });

  it('allows only the owner or an admin to reopen resolved tickets', () => {
    expect(() => assertTicketStatusTransition(ticket(TicketStatus.RESOLVED), TicketStatus.OPEN, owner)).not.toThrow();
    expect(() => assertTicketStatusTransition(ticket(TicketStatus.RESOLVED), TicketStatus.OPEN, admin)).not.toThrow();
    expect(() => assertTicketStatusTransition(ticket(TicketStatus.RESOLVED), TicketStatus.OPEN, assignedAgent)).toThrow(
      ForbiddenException,
    );
  });

  it('requires a close reason and allows closing only by the owner or admin', () => {
    expect(() => assertTicketStatusTransition(ticket(TicketStatus.OPEN), TicketStatus.CLOSED, owner)).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertTicketStatusTransition(
        ticket(TicketStatus.OPEN),
        TicketStatus.CLOSED,
        owner,
        CloseReason.CANCELED,
      ),
    ).not.toThrow();
    expect(() =>
      assertTicketStatusTransition(
        ticket(TicketStatus.OPEN),
        TicketStatus.CLOSED,
        admin,
        CloseReason.RESOLVED,
      ),
    ).not.toThrow();
    expect(() =>
      assertTicketStatusTransition(
        ticket(TicketStatus.OPEN),
        TicketStatus.CLOSED,
        assignedAgent,
        CloseReason.RESOLVED,
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.PENDING_USER_RESPONSE,
    TicketStatus.RESOLVED,
  ])('allows the ticket owner or admin to close a %s ticket', (status) => {
    expect(() =>
      assertTicketStatusTransition(ticket(status), TicketStatus.CLOSED, owner, CloseReason.NO_RESPONSE),
    ).not.toThrow();
    expect(() =>
      assertTicketStatusTransition(ticket(status), TicketStatus.CLOSED, admin, CloseReason.NO_RESPONSE),
    ).not.toThrow();
  });

  it.each(Object.values(TicketStatus))('treats closed tickets as terminal when targeting %s', (target) => {
    expect(() =>
      assertTicketStatusTransition(ticket(TicketStatus.CLOSED), target, owner, CloseReason.CANCELED),
    ).toThrow('Closed tickets cannot be reopened; submit a new ticket');
  });
});