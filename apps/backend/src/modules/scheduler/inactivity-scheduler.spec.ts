import { CloseReason, TicketStatus } from '../../generated/prisma/enums.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { InactivityScheduler } from './inactivity-scheduler.js';
import { vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';

describe('InactivityScheduler', () => {
  it('applies the inactivity cutoff and closes both eligible statuses with their matching reasons', async () => {
    const now = new Date('2026-01-08T00:00:00.000Z');
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    const tickets = [
      {
        id: 'resolved-ticket',
        ticketNumber: 41,
        status: TicketStatus.RESOLVED,
        reporterId: 'reporter-1',
        reporter: { email: 'one@example.com' },
      },
      {
        id: 'pending-ticket',
        ticketNumber: 42,
        status: TicketStatus.PENDING_USER_RESPONSE,
        reporterId: 'reporter-2',
        reporter: { email: 'two@example.com' },
      },
    ];
    const transactionClient = {
      ticket: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      ticketComment: { create: vi.fn().mockResolvedValue({ id: 'comment-1' }) },
    };
    const prisma = {
      ticket: { findMany: vi.fn().mockResolvedValue(tickets) },
      $transaction: vi.fn(
        async (operation: (transaction: Prisma.TransactionClient) => Promise<boolean>) =>
          operation(transactionClient as unknown as Prisma.TransactionClient),
      ),
    } as unknown as PrismaService;
    const systemConfig = {
      getInactivityDays: vi.fn().mockResolvedValue(7),
    } as unknown as SystemConfigService;
    const mail = {
      sendTicketClosed: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailService;
    const scheduler = new InactivityScheduler(prisma, systemConfig, mail);

    await expect(scheduler.closeInactiveTickets(now)).resolves.toEqual({ closed: 2, failed: 0 });

    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [TicketStatus.RESOLVED, TicketStatus.PENDING_USER_RESPONSE] },
        lastActivityAt: { lt: cutoff },
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        reporterId: true,
        reporter: { select: { email: true } },
      },
    });
    expect(transactionClient.ticket.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'resolved-ticket', status: TicketStatus.RESOLVED, lastActivityAt: { lt: cutoff } },
      data: { status: TicketStatus.CLOSED, closeReason: CloseReason.RESOLVED, lastActivityAt: now },
    });
    expect(transactionClient.ticket.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'pending-ticket',
        status: TicketStatus.PENDING_USER_RESPONSE,
        lastActivityAt: { lt: cutoff },
      },
      data: { status: TicketStatus.CLOSED, closeReason: CloseReason.NO_RESPONSE, lastActivityAt: now },
    });
    expect(transactionClient.ticketComment.create).toHaveBeenNthCalledWith(2, {
      data: {
        ticketId: 'pending-ticket',
        authorId: 'reporter-2',
        content: '[System] Ticket automatically closed after 7 days of inactivity (reason: NO_RESPONSE).',
      },
    });
    expect(mail.sendTicketClosed).toHaveBeenNthCalledWith(1, {
      to: 'one@example.com',
      ticketNumber: 41,
      closeReason: CloseReason.RESOLVED,
      ticketId: 'resolved-ticket',
    });
    expect(mail.sendTicketClosed).toHaveBeenNthCalledWith(2, {
      to: 'two@example.com',
      ticketNumber: 42,
      closeReason: CloseReason.NO_RESPONSE,
      ticketId: 'pending-ticket',
    });
  });
});