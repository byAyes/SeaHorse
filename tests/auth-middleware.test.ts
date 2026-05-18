import { describe, it, expect, beforeEach } from '@jest/globals';
import { authenticate } from '../src/lib/auth/middleware';
import { NextRequest } from 'next/server';

function createRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['authorization'] = authHeader;
  }
  return new NextRequest('http://localhost/api/test', { headers }) as unknown as NextRequest;
}

describe('authenticate', () => {
  const ORIGINAL_TOKEN = process.env.ADMIN_API_TOKEN;

  beforeEach(() => {
    // Reset env before each test to avoid cross-test leaks
    delete process.env.ADMIN_API_TOKEN;
  });

  afterAll(() => {
    // Restore original value if it existed
    if (ORIGINAL_TOKEN !== undefined) {
      process.env.ADMIN_API_TOKEN = ORIGINAL_TOKEN;
    } else {
      delete process.env.ADMIN_API_TOKEN;
    }
  });

  // ── No token configured ──

  it('should pass authentication when ADMIN_API_TOKEN is not set', async () => {
    const result = await authenticate(createRequest());
    expect(result).toEqual({ user: 'admin' });
  });

  it('should pass even without an Authorization header when no token is configured', async () => {
    const result = await authenticate(createRequest());
    expect(result).toEqual({ user: 'admin' });
  });

  // ── Valid token ──

  it('should pass with a valid Bearer token', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest('Bearer my-secret-token-123'));
    expect(result).toEqual({ user: 'admin' });
  });

  it('should pass with a token that has extra whitespace', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest('Bearer   my-secret-token-123  '));
    expect(result).toEqual({ user: 'admin' });
  });

  // ── Missing or invalid header ──

  it('should return 401 when Authorization header is missing', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest());
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Authorization header is required');
  });

  it('should return 401 when Authorization header is empty', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest(''));
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(401);
  });

  it('should return 401 when Authorization header does not use Bearer scheme', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest('Basic dXNlcjpwYXNz'));
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Authorization header must use Bearer scheme');
  });

  it('should return 401 when Bearer token is empty', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    // Use standard Request to avoid any NextRequest header quirks
    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer ' },
    }) as unknown as NextRequest;

    const result = await authenticate(request);
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(401);
  });

  // ── Wrong token ──

  it('should return 401 when Bearer token does not match', async () => {
    process.env.ADMIN_API_TOKEN = 'my-secret-token-123';

    const result = await authenticate(createRequest('Bearer wrong-token'));
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid authentication token');
  });
});
