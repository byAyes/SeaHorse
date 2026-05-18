import type { SendResult } from '../gmail';
import * as nodemailer from 'nodemailer';

interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export class SMTPProvider {
  private config: SMTPConfig;
  private transporter: nodemailer.Transporter;

  constructor(config: SMTPConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for port 465, false for other ports
      requireTLS: true, // enforce TLS on port 587 (required by Gmail)
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from?: string,
    html?: string,
    cc?: string | string[],
  ): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: from || this.config.from,
        to,
        cc,
        subject,
        text: body,
        ...(html ? { html } : {}),
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
