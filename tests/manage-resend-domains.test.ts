import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { manageResendDomains } from '../scripts/manage-resend-domains';
import { ResendProvider } from '../src/lib/email/providers/resend';

// Mock the ResendProvider
jest.mock('../src/lib/email/providers/resend');

describe('manageResendDomains', () => {
  const mockApiKey = 'unit-test-mock-key-do-not-use';
  const mockFromEmail = 'test@example.com';
  const mockListDomainsResult = {
    success: true,
    domains: [
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
    ],
  };

  const mockCreateDomainResult = {
    success: true,
    domain: {
      id: 'domain-999',
      name: 'updates.example.com',
      status: 'pending' as const,
      created_at: '2024-01-03T00:00:00Z',
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
    },
  };

  const mockGetDomainResult = {
    success: true,
    domain: {
      id: 'domain-123',
      name: 'example.com',
      status: 'verified' as const,
      created_at: '2024-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    // Reset process.exit mock
    jest.clearAllMocks();

    // Mock process.exit to prevent actual exit
    process.exit = jest.fn() as any;

    // Mock console methods
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });

  it('should list domains, create a new domain, and get domain details', async () => {
    // Setup mocks
    process.env.RESEND_API_KEY = mockApiKey;
    process.env.RESEND_FROM_EMAIL = mockFromEmail;

    const mockProvider = {
      listDomains: jest.fn().mockResolvedValue(mockListDomainsResult),
      createDomain: jest.fn().mockResolvedValue(mockCreateDomainResult),
      getDomain: jest.fn().mockResolvedValue(mockGetDomainResult),
    } as any;

    (ResendProvider as jest.Mock).mockImplementation(() => mockProvider);

    // Run the function
    await manageResendDomains();

    // Verify listDomains was called
    expect(mockProvider.listDomains).toHaveBeenCalledWith();

    // Verify createDomain was called with correct parameters
    expect(mockProvider.createDomain).toHaveBeenCalledWith({
      name: 'updates.example.com',
      customReturnPath: 'outbound',
    });

    // Verify getDomain was called with first domain's ID
    expect(mockProvider.getDomain).toHaveBeenCalledWith('domain-123');

    // Verify console logs
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Listing current domains'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('example.com'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Creating new domain'));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Domain created successfully'),
    );
  });

  it('should handle empty domains list', async () => {
    process.env.RESEND_API_KEY = mockApiKey;
    process.env.RESEND_FROM_EMAIL = mockFromEmail;

    const mockProvider = {
      listDomains: jest.fn().mockResolvedValue({
        success: true,
        domains: [],
      }),
      createDomain: jest.fn().mockResolvedValue(mockCreateDomainResult),
      getDomain: jest.fn().mockResolvedValue(mockGetDomainResult),
    } as any;

    (ResendProvider as jest.Mock).mockImplementation(() => mockProvider);

    await manageResendDomains();

    expect(mockProvider.listDomains).toHaveBeenCalled();
    expect(mockProvider.createDomain).toHaveBeenCalled();
    expect(mockProvider.getDomain).not.toHaveBeenCalled(); // Should not call getDomain if no domains
  });

  it('should handle missing environment variables', async () => {
    // Clear environment variables
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    await manageResendDomains();

    expect(console.error).toHaveBeenCalledWith(
      'Missing required environment variables: RESEND_API_KEY and RESEND_FROM_EMAIL',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle domain creation failures', async () => {
    process.env.RESEND_API_KEY = mockApiKey;
    process.env.RESEND_FROM_EMAIL = mockFromEmail;

    const mockProvider = {
      listDomains: jest.fn().mockResolvedValue(mockListDomainsResult),
      createDomain: jest.fn().mockResolvedValue({
        success: false,
        error: 'Domain name already exists',
      }),
      getDomain: jest.fn().mockResolvedValue(mockGetDomainResult),
    } as any;

    (ResendProvider as jest.Mock).mockImplementation(() => mockProvider);

    await manageResendDomains();

    expect(mockProvider.createDomain).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Failed to create domain:',
      'Domain name already exists',
    );
  });

  it('should handle API failures gracefully', async () => {
    process.env.RESEND_API_KEY = mockApiKey;
    process.env.RESEND_FROM_EMAIL = mockFromEmail;

    const mockProvider = {
      listDomains: jest.fn().mockResolvedValue({
        success: false,
        error: 'Unauthorized: Invalid API key',
      }),
      createDomain: jest.fn(),
      getDomain: jest.fn(),
    } as any;

    (ResendProvider as jest.Mock).mockImplementation(() => mockProvider);

    await manageResendDomains();

    expect(mockProvider.listDomains).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Failed to list domains:',
      'Unauthorized: Invalid API key',
    );
  });

  it('should handle domain creation with DNS records', async () => {
    process.env.RESEND_API_KEY = mockApiKey;
    process.env.RESEND_FROM_EMAIL = mockFromEmail;

    const mockProvider = {
      listDomains: jest.fn().mockResolvedValue(mockListDomainsResult),
      createDomain: jest.fn().mockResolvedValue(mockCreateDomainResult),
      getDomain: jest.fn().mockResolvedValue(mockGetDomainResult),
    } as any;

    (ResendProvider as jest.Mock).mockImplementation(() => mockProvider);

    await manageResendDomains();

    // Verify DNS records logging
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DNS Configuration Required'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('SPF Record'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DKIM Record'));
  });
});
