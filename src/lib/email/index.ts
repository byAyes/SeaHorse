import type { SendResult } from './gmail';
import { sendEmail as sendGmailEmail } from './gmail';
import { SendGridProvider } from './providers/sendgrid';
import { SMTPProvider } from './providers/smtp';
import { ResendProvider } from './providers/resend';
import type { SendGridProvider as SendGridProviderType } from './providers/sendgrid';
import type { SMTPProvider as SMTPProviderType } from './providers/smtp';
import type { ResendProvider as ResendProviderType } from './providers/resend';

// Lazy providers — initialized on first use so env vars are available
let _sendGridProvider: SendGridProviderType | null = null;
let _smtpProvider: SMTPProviderType | null = null;
let _resendProvider: ResendProviderType | null = null;

function getSendGridProvider(): SendGridProviderType | null {
  if (!_sendGridProvider && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    _sendGridProvider = new SendGridProvider({
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL,
    });
  }
  return _sendGridProvider;
}

function getSmtpProvider(): SMTPProviderType | null {
  if (
    !_smtpProvider &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  ) {
    _smtpProvider = new SMTPProvider({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    });
  }
  return _smtpProvider;
}

function getResendProvider(): ResendProviderType | null {
  if (!_resendProvider && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    _resendProvider = new ResendProvider({
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL,
    });
  }
  return _resendProvider;
}

/**
 * Send email using configured provider
 * Falls back to Gmail if specific provider is not configured
 * @param to - Recipient email
 * @param subject - Email subject
 * @param body - Plain text body (fallback)
 * @param from - Optional sender override
 * @param html - Optional HTML body (rich email content)
 * @param cc - Optional CC recipient(s)
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  from?: string,
  html?: string,
  cc?: string | string[],
): Promise<SendResult> {
  try {
    const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

    switch (provider) {
      case 'sendgrid': {
        const p = getSendGridProvider();
        if (!p) {
          throw new Error('SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL');
        }
        return await p.sendEmail(to, subject, body, from);
      }

      case 'smtp': {
        const p = getSmtpProvider();
        if (!p) {
          throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
        }
        return await p.sendEmail(to, subject, body, from, html, cc);
      }

      case 'resend': {
        const p = getResendProvider();
        if (!p) {
          throw new Error('Resend not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL');
        }
        return await p.sendEmail(to, subject, body, from, html, cc);
      }

      case 'gmail':
      default:
        return await sendGmailEmail(to, subject, body, from, html, cc);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
