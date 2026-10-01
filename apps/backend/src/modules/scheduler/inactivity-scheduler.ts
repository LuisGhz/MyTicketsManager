import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CloseReason, TicketStatus } from '../../generated/prisma/enums.js';
import { MailService } from '../../shared/infrastructure/mail/mail.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';

@Injectable()
export class InactivityScheduler {
  readonly #logger = new Logger(InactivityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async closeInactiveTickets(now = new Date()): Promise<{ closed: number; failed: number }> {
    const inactivityDays = await this.systemConfig.getInactivityDays();
    const cutoff = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);
    const tickets = await this.prisma.ticket.findMany({
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

    let closed = 0;
    let failed = 0;

    for (const ticket of tickets) {
      const closeReason = ticket.status === TicketStatus.RESOLVED
        ? CloseReason.RESOLVED
        : CloseReason.NO_RESPONSE;

      try {
        const didClose = await this.prisma.$transaction(async (transaction) => {
          const result = await transaction.ticket.updateMany({
            where: {
              id: ticket.id,
              status: ticket.status,
              lastActivityAt: { lt: cutoff },
            },
            data: {
              status: TicketStatus.CLOSED,
              closeReason,
              lastActivityAt: now,
            },
          });
          if (result.count === 0) return false;

          await transaction.ticketComment.create({
            data: {
              ticketId: ticket.id,
              authorId: ticket.reporterId,
              content: `[System] Ticket automatically closed after ${inactivityDays} days of inactivity (reason: ${closeReason}).`,
            },
          });
          return true;
        });

        if (!didClose) continue;

        closed += 1;
        await this.mail.sendTicketClosed({
          to: ticket.reporter.email,
          ticketNumber: ticket.ticketNumber,
          closeReason,
          ticketId: ticket.id,
        });
      } catch (error: unknown) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.#logger.error(`Failed to close inactive ticket ${ticket.id}: ${message}`);
      }
    }

    return { closed, failed };
  }
}