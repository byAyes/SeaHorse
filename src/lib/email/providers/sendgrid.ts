import type { SendResult } from '../gmail';

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
}

export class SendGridProvider {
  private config: SendGridConfig;

  constructor(config: SendGridConfig) {
    this.config = config;
  }

  async sendEmail(to: string, subject: string, body: string, from?: string): Promise<SendResult> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
            },
          ],
          from: { email: from || this.config.fromEmail },
          subject,
          content: [
            {
              type: 'text/plain',
              value: body,
            },
          ],
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get('x-message-id');
        return {
          success: true,
          messageId: messageId || undefined,
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          error: error.errors?.[0]?.message || `SendGrid error: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
