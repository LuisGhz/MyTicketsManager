import { Logger } from '@nestjs/common';
import { vi } from 'vitest';
import { AppConfigService } from '../../../config/app-config.service.js';
import { MailService } from './mail.service.js';

describe('MailService', () => {
  it('logs the email when no Resend API key is configured', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const config = {
      resendApiKey: undefined,
      mailFrom: 'MyTicketsManager <onboarding@resend.dev>',
      appUrl: 'http://localhost:5173',
    } as AppConfigService;
    const service = new MailService(config);

    await service.sendTicketCreated({
      to: 'user@example.com',
      ticketNumber: 12,
      title: '<script>alert(1)</script>',
      status: 'OPEN',
      ticketId: 'ticket-12',
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('&lt;script&gt;'));
    log.mockRestore();
  });
});