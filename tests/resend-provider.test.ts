import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResendProvider } from '../src/lib/email/providers/resend';
import type { SendResult } from '../src/lib/email/gmail';

describe('ResendProvider', () => {
  const mockApiKey = 'unit-test-mock-key-do-not-use';
  const mockFromEmail = 'test@example.com';
  let provider: ResendProvider;

  beforeEach(() => {
    provider = new ResendProvider({ apiKey: mockApiKey, fromEmail: mockFromEmail });
    global.fetch = jest.fn();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const mockResponse = { id: 'email-123' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result: SendResult = await provider.sendEmail(
        'to@test.com',
        'Test Subject',
        'Test Body',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"to":"to@test.com"'),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email-123');
    });

    it('should use provided from address when specified', async () => {
      const mockResponse = { id: 'email-456' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.sendEmail('to@test.com', 'Test', 'Body', 'custom@example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('"from":"custom@example.com"'),
        }),
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid recipient email' }),
      });

      const result: SendResult = await provider.sendEmail('invalid', 'Test', 'Body');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient email');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const result: SendResult = await provider.sendEmail('to@test.com', 'Test', 'Body');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('createDomain', () => {
    const mockDomainResponse = {
      id: 'domain-123',
      name: 'updates.example.com',
      status: 'pending' as const,
      created_at: '2024-01-01T00:00:00Z',
      dns_records: {
        spf: {
          name: 'updates.example.com',
          value: 'v=spf1 include:spf.resend.com ~all',
        },
        dkim: {
          name: 'resend._domainkey.updates.example.com',
          value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...',
        },
      },
    };

    it('should create domain successfully with custom return path', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDomainResponse,
      });

      const result = await provider.createDomain({
        name: 'updates.example.com',
        customReturnPath: 'outbound',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/domains',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
          body: JSON.stringify({
            name: 'updates.example.com',
            custom_return_path: 'outbound',
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.domain).toEqual(mockDomainResponse);
    });

    it('should create domain without custom return path', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDomainResponse,
      });

      await provider.createDomain({ name: 'example.com' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/domains',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'example.com',
          }),
        }),
      );
    });

    it('should handle creation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Domain name is invalid' }),
      });

      const result = await provider.createDomain({ name: 'invalid-domain!' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain name is invalid');
    });
  });

  describe('listDomains', () => {
    const mockDomainsResponse = [
      {
        id: 'domain-123',
        name: 'example.com',
        status: 'verified' as const,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'domain-456',
        name: 'updates.example.com',
        status: 'pending' as const,
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    it('should list domains successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDomainsResponse,
      });

      const result = await provider.listDomains();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/domains',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.domains).toEqual(mockDomainsResponse);
    });

    it('should handle empty domains list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await provider.listDomains();

      expect(result.success).toBe(true);
      expect(result.domains).toEqual([]);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const result = await provider.listDomains();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('getDomain', () => {
    const mockDomainResponse = {
      id: 'domain-123',
      name: 'example.com',
      status: 'verified' as const,
      created_at: '2024-01-01T00:00:00Z',
      dns_records: {
        spf: {
          name: 'example.com',
          value: 'v=spf1 include:spf.resend.com ~all',
        },
        dkim: {
          name: 'resend._domainkey.example.com',
          value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...',
        },
      },
    };

    it('should get domain details successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDomainResponse,
      });

      const result = await provider.getDomain('domain-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/domains/domain-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.domain).toEqual(mockDomainResponse);
    });

    it('should handle domain not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Domain not found' }),
        status: 404,
      });

      const result = await provider.getDomain('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain not found');
    });
  });
});
