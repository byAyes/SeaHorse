import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// OAuth2 configuration
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Set credentials if tokens are available
if (process.env.GMAIL_ACCESS_TOKEN && process.env.GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    access_token: process.env.GMAIL_ACCESS_TOKEN,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
}

// Initialize Gmail API client
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Generate OAuth2 authorization URL for initial setup
 * @returns Authorization URL to present to user
 */
export function getAuthUrl(): string {
  const scopes = ['https://www.googleapis.com/auth/gmail.send'];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  return authUrl;
}

/**
 * Exchange authorization code for tokens
 * @param code Authorization code from OAuth2 callback
 * @returns Object containing access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
}> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
  };
}

/**
 * Result of sending an email
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Gmail API
 * @param to Recipient email address
 * @param subject Email subject
 * @param body Email body (plain text fallback)
 * @param from Sender email (optional, defaults to authenticated user)
 * @param html Optional HTML body for rich email content
 * @param cc Optional CC recipient(s)
 * @returns SendResult with success status and message ID
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  from?: string,
  html?: string,
  cc?: string | string[]
): Promise<SendResult> {
  try {
    // Create RFC 2822 formatted email
    const sender = from || 'me';

    // Build CC header line if CC recipients are specified
    const ccHeader = cc
      ? `Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`
      : null;

    // Build MIME multipart email if HTML is provided, otherwise plain text
    let email: string;

    if (html) {
      const boundary = '----=_Part_' + Date.now() + '_' + randomUUID().replace(/-/g, '');
      const headers = [
        `From: ${sender}`,
        `To: ${to}`,
        ...(ccHeader ? [ccHeader] : []),
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        body,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        html,
        '',
        `--${boundary}--`,
      ];
      email = headers.join('\n');
    } else {
      const headers = [
        `From: ${sender}`,
        `To: ${to}`,
        ...(ccHeader ? [ccHeader] : []),
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ];
      email = headers.join('\n');
    }

    // Base64 encode the email (URL-safe)
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const gmailService = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmailService.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    return {
      success: true,
      messageId: response.data.id ?? undefined,
    };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Authenticate Gmail client with OAuth2
 * This is the main entry point for authentication
 */
export async function authenticateGmail(): Promise<void> {
  // Check if we have credentials
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Gmail OAuth2 credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  }

  // The OAuth2 client is already initialized with credentials from env vars
  // If tokens need to be refreshed, the library handles it automatically
  console.log('Gmail OAuth2 client initialized');
}

export { oauth2Client };
