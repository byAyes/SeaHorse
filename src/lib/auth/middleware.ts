/**
 * Shared authentication middleware for API routes.
 *
 * Usage:
 *   import { authenticate } from '@/lib/auth/middleware';
 *
 *   export async function GET(request: NextRequest) {
 *     const auth = await authenticate(request);
 *     if (auth instanceof NextResponse) return auth;
 *     // ... route handler logic
 *   }
 *
 * When ADMIN_API_TOKEN is not set, authentication is skipped entirely
 * (safe default for local/development usage).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface AuthUser {
  /** Authenticated user identity (always 'admin' for token-based auth) */
  user: 'admin';
}

/**
 * Authenticate a request using Bearer token.
 *
 * - If ADMIN_API_TOKEN is not set → passes (local/dev mode)
 * - If ADMIN_API_TOKEN is set → requires `Authorization: Bearer <token>`
 *
 * Returns the user identity on success, or a 401 NextResponse on failure.
 */
export async function authenticate(
  request: NextRequest
): Promise<AuthUser | NextResponse> {
  const adminToken = process.env.ADMIN_API_TOKEN;

  // No token configured — skip auth (safe for local development)
  if (!adminToken) {
    return { user: 'admin' };
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header is required' },
      { status: 401 }
    );
  }

  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header must use Bearer scheme' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token || token !== adminToken) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  return { user: 'admin' };
}
