import type { SendResult } from '../gmail';
import { logger } from '../../automation/logger';

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

interface ResendResponse {
  id: string;
  message?: string;
}

class NetworkUtil {
  static async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    timeout: number = 30000,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export interface DomainInfo {
  id: string;
  name: string;
  status: string;
  created_at: string;
  dns_records?: {
    spf?: { name: string; value: string };
    dkim?: { name: string; value: string };
  };
}

export interface CreateDomainOptions {
  name: string;
  customReturnPath?: string;
}

export interface DomainActionResult {
  success: boolean;
  domain?: DomainInfo;
  domains?: DomainInfo[];
  error?: string;
}

export class ResendProvider {
  private config: ResendConfig;

  constructor(config: ResendConfig) {
    this.config = config;
  }

  /** Normalize a Resend API domain response into our DomainInfo shape */
  private parseDomain(data: Record<string, unknown>): DomainInfo {
    const domain: DomainInfo = {
      id: data.id as string,
      name: data.name as string,
      status: data.status as string,
      created_at: data.created_at as string,
    };
    const records = (data.dns_records || data.records) as Record<string, unknown> | undefined;
    if (records) {
      domain.dns_records = {
        spf: (data.dns_records as Record<string, unknown>)?.spf as
          | { name: string; value: string }
          | undefined,
        dkim: (data.dns_records as Record<string, unknown>)?.dkim as
          | { name: string; value: string }
          | undefined,
      };
    }
    return domain;
  }

  async createDomain(options: CreateDomainOptions): Promise<DomainActionResult> {
    logger.info('createDomain: Creating domain', { name: options.name });

    try {
      const response = await NetworkUtil.fetchWithRetry('https://api.resend.com/domains', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: options.name,
          ...(options.customReturnPath ? { custom_return_path: options.customReturnPath } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        logger.success('createDomain: Successfully created domain');
        return { success: true, domain: this.parseDomain(data) };
      } else {
        const err = await response.json();
        const errorMessage = err.message || `Resend error: ${response.status}`;
        logger.error(`createDomain: API error (${response.status}): ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`createDomain: Network error: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  async listDomains(): Promise<DomainActionResult> {
    logger.info('listDomains: Fetching domains');

    try {
      const response = await NetworkUtil.fetchWithRetry('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const rawList: Record<string, unknown>[] = data.data || data || [];
        return { success: true, domains: rawList.map((d) => this.parseDomain(d)) };
      } else {
        const err = await response.json();
        const errorMessage = err.message || `Resend error: ${response.status}`;
        logger.error(`listDomains: API error (${response.status}): ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`listDomains: Network error: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  async getDomain(domainId: string): Promise<DomainActionResult> {
    logger.info('getDomain: Fetching domain', { domainId });

    try {
      const response = await NetworkUtil.fetchWithRetry(
        `https://api.resend.com/domains/${domainId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return { success: true, domain: this.parseDomain(data) };
      } else {
        const err = await response.json();
        const errorMessage = err.message || `Resend error: ${response.status}`;
        logger.error(`getDomain: API error (${response.status}): ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`getDomain: Network error: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from?: string,
    html?: string,
    cc?: string | string[],
  ): Promise<SendResult> {
    logger.info('sendEmail: Sending email', {
      to,
      cc,
      subject,
      from: from || this.config.fromEmail,
    });

    try {
      const payload: Record<string, unknown> = {
        from: from || this.config.fromEmail,
        to,
        subject,
        text: body,
      };

      // Include HTML version if provided
      if (html) {
        payload.html = html;
      }

      // Include CC recipients if provided
      if (cc) {
        payload.cc = Array.isArray(cc) ? cc : [cc];
      }

      const response = await NetworkUtil.fetchWithRetry(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        3, // maxRetries
        30000, // 30 second timeout
      );

      if (response.ok) {
        const data: ResendResponse = await response.json();
        logger.info('sendEmail: Successfully sent', { messageId: data.id });
        logger.success('sendEmail: Successfully sent');
        return {
          success: true,
          messageId: data.id,
        };
      } else {
        const error = await response.json();
        const errorMessage = error.message || `Resend error: ${response.status}`;
        logger.error(`sendEmail: API error (${response.status}): ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`sendEmail: Network error: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}

export class ResendDomainManager {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listDomains(): Promise<Array<{ id: string; name: string; status: string }>> {
    const response = await NetworkUtil.fetchWithRetry(
      'https://api.resend.com/domains',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
      3,
      30000,
    );

    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    } else {
      throw new Error(`Failed to list domains: ${response.status}`);
    }
  }

  async addDomain(name: string): Promise<{
    id: string;
    name: string;
    status: string;
    records: Array<{ type: string; host: string; value: string; priority?: number }>;
  }> {
    const response = await NetworkUtil.fetchWithRetry(
      'https://api.resend.com/domains',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      },
      3,
      30000,
    );

    if (response.ok) {
      const data = await response.json();
      return {
        id: data.id,
        name: data.name,
        status: data.status,
        records: data.records || [],
      };
    } else {
      const error = await response.json();
      throw new Error(error.message || `Failed to add domain: ${response.status}`);
    }
  }

  async verifyDomain(domainId: string): Promise<{ id: string; status: string }> {
    const response = await NetworkUtil.fetchWithRetry(
      `https://api.resend.com/domains/${domainId}/verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
      3,
      30000,
    );

    if (response.ok) {
      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
      };
    } else {
      const error = await response.json();
      throw new Error(error.message || `Failed to verify domain: ${response.status}`);
    }
  }
}
