import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../../config/app-config.service.js';

export interface SendAccountInvitationParams {
  to: string;
  firstName: string;
  verifyUrl: string;
  expiresAt: Date;
}

export interface SendTicketCreatedParams {
  to: string;
  ticketNumber: number;
  title: string;
  status: string;
  ticketId: string;
}

export interface SendTicketAssignedParams {
  to: string;
  ticketNumber: number;
  reporterName: string;
  priority: string;
  ticketId: string;
}

export interface SendUnassignedTicketAlertParams {
  to: string[];
  ticketNumber: number;
  reporterName: string;
  departmentName: string;
  ticketId: string;
}

export interface SendNewCommentByAgentParams {
  to: string;
  ticketNumber: number;
  snippet: string;
  ticketId: string;
}

export interface SendNewCommentByUserParams {
  to: string;
  ticketNumber: number;
  snippet: string;
  ticketId: string;
}

export interface SendTicketResolvedParams {
  to: string;
  ticketNumber: number;
  details: string;
  ticketId: string;
}

export interface SendTicketClosedParams {
  to: string;
  ticketNumber: number;
  closeReason: string;
  ticketId: string;
}

export interface SendReassignmentRequestedParams {
  to: string[];
  ticketNumber: number;
  requesterName: string;
  reason: string;
}

@Injectable()
export class MailService {
  readonly #logger = new Logger(MailService.name);
  readonly #resend: Resend | undefined;

  constructor(private readonly config: AppConfigService) {
    if (config.resendApiKey) this.#resend = new Resend(config.resendApiKey);
  }

  async sendAccountInvitation({ to, firstName, verifyUrl, expiresAt }: SendAccountInvitationParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: 'Account Invitation - Verify Your Email',
      html: this.#template(
        `<p>Hello ${this.#escapeHtml(firstName)},</p><p>Verify your email to activate your account.</p><p><a href="${this.#escapeHtml(verifyUrl)}">Verify email</a></p><p>This link expires at ${this.#escapeHtml(expiresAt.toISOString())}.</p>`,
      ),
    });
  }

  async sendTicketCreated({ to, ticketNumber, title, status, ticketId }: SendTicketCreatedParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: `Ticket Received: [#${ticketNumber}] ${title}`,
      html: this.#template(
        `<p>Your ticket <strong>#${ticketNumber}</strong> has been received.</p><p>${this.#escapeHtml(title)}</p><p>Status: ${this.#escapeHtml(status)}</p><p>Ticket ID: ${this.#escapeHtml(ticketId)}</p>`,
      ),
    });
  }

  async sendTicketAssigned({ to, ticketNumber, reporterName, priority, ticketId }: SendTicketAssignedParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: `Ticket Assigned to You: [#${ticketNumber}]`,
      html: this.#template(
        `<p>Ticket <strong>#${ticketNumber}</strong> has been assigned to you.</p><p>Reported by ${this.#escapeHtml(reporterName)}.</p><p>Priority: ${this.#escapeHtml(priority)}</p><p>Ticket ID: ${this.#escapeHtml(ticketId)}</p>`,
      ),
    });
  }

  async sendUnassignedTicketAlert({
    to,
    ticketNumber,
    reporterName,
    departmentName,
    ticketId,
  }: SendUnassignedTicketAlertParams): Promise<void> {
    const assignUrl = `${this.config.appUrl.replace(/\/+$/, '')}/admin/tickets/${encodeURIComponent(ticketId)}`;
    await this.#sendEmail({
      to,
      subject: `Action Required: Unassigned Ticket Created [#${ticketNumber}]`,
      html: this.#template(
        `<p>Ticket <strong>#${ticketNumber}</strong> needs an assignee.</p><p>Reported by ${this.#escapeHtml(reporterName)}.</p><p>Department: ${this.#escapeHtml(departmentName)}</p><p><a href="${this.#escapeHtml(assignUrl)}">Assign ticket</a></p>`,
      ),
    });
  }

  async sendNewCommentByAgent({ to, ticketNumber, snippet, ticketId }: SendNewCommentByAgentParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: `New Response on Ticket [#${ticketNumber}]`,
      html: this.#template(
        `<p>There is a new response on ticket <strong>#${ticketNumber}</strong>.</p><blockquote>${this.#escapeHtml(snippet)}</blockquote><p>Ticket ID: ${this.#escapeHtml(ticketId)}</p>`,
      ),
    });
  }

  async sendNewCommentByUser({ to, ticketNumber, snippet, ticketId }: SendNewCommentByUserParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: `User Replied to Ticket [#${ticketNumber}]`,
      html: this.#template(
        `<p>The user replied to ticket <strong>#${ticketNumber}</strong>.</p><blockquote>${this.#escapeHtml(snippet)}</blockquote><p>Ticket ID: ${this.#escapeHtml(ticketId)}</p>`,
      ),
    });
  }

  async sendTicketResolved({ to, ticketNumber, details, ticketId }: SendTicketResolvedParams): Promise<void> {
    const reopenUrl = `${this.config.appUrl.replace(/\/+$/, '')}/tickets/my/${encodeURIComponent(ticketId)}`;
    await this.#sendEmail({
      to,
      subject: `Ticket Resolved: [#${ticketNumber}]`,
      html: this.#template(
        `<p>Ticket <strong>#${ticketNumber}</strong> has been resolved.</p><p>${this.#escapeHtml(details)}</p><p><a href="${this.#escapeHtml(reopenUrl)}">Reopen ticket</a></p>`,
      ),
    });
  }

  async sendTicketClosed({ to, ticketNumber, closeReason, ticketId }: SendTicketClosedParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: `Ticket Closed: [#${ticketNumber}] (${closeReason})`,
      html: this.#template(
        `<p>Ticket <strong>#${ticketNumber}</strong> has been closed.</p><p>Reason: ${this.#escapeHtml(closeReason)}</p><p>Ticket ID: ${this.#escapeHtml(ticketId)}</p>`,
      ),
    });
  }

  async sendReassignmentRequested({
    to,
    ticketNumber,
    requesterName,
    reason,
  }: SendReassignmentRequestedParams): Promise<void> {
    await this.#sendEmail({
      to,
      subject: 'Action Required: Reassignment Request',
      html: this.#template(
        `<p>A reassignment was requested for ticket <strong>#${ticketNumber}</strong>.</p><p>Requested by ${this.#escapeHtml(requesterName)}.</p><p>Reason: ${this.#escapeHtml(reason)}</p>`,
      ),
    });
  }

  async #sendEmail({
    to,
    subject,
    html,
  }: {
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.#resend) {
      this.#logger.log(JSON.stringify({ to, subject, html }));
      return;
    }

    try {
      const { error } = await this.#resend.emails.send({
        from: this.config.mailFrom,
        to,
        subject,
        html,
      });
      if (error) this.#logger.error(`Email send failed for "${subject}": ${error.message}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.#logger.error(`Email send failed for "${subject}": ${message}`);
    }
  }

  #template(content: string): string {
    return `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">${content}</div>`;
  }

  #escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}