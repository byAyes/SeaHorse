/**
 * API endpoint for managing server-side API keys.
 *
 * POST  → Save API keys to the server config store
 * GET   → Return which providers have keys configured (without exposing values)
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveConfig, loadConfig, getActiveAiProvider } from '@/lib/config/store';
import { authenticate } from '@/lib/auth/middleware';

/**
 * POST /api/config/keys
 *
 * Accepts one or more API keys in the request body:
 * {
 *   jsearchApiKey?: string,
 *   geminiApiKey?: string,
 *   openrouterApiKey?: string,
 *   nimApiKey?: string
 * }
 *
 * Only the provided keys are saved — existing keys are preserved.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate that only known keys are accepted
    const validKeys = ['jsearchApiKey', 'geminiApiKey', 'openrouterApiKey', 'nimApiKey'];
    const partial: Record<string, string> = {};

    for (const key of validKeys) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || body[key].trim().length === 0) {
          return NextResponse.json(
            { success: false, error: `Invalid value for ${key}` },
            { status: 400 },
          );
        }
        partial[key] = body[key].trim();
      }
    }

    if (Object.keys(partial).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid API keys provided' },
        { status: 400 },
      );
    }

    await saveConfig(partial);

    return NextResponse.json({
      success: true,
      saved: Object.keys(partial),
      // Never expose actual key values — just confirm what was saved
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save API keys',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/config/keys
 *
 * Returns which AI provider keys are configured (without exposing the values).
 * This allows the frontend to know whether to show "configure key" warnings.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const config = await loadConfig();
    const activeProvider = await getActiveAiProvider();

    return NextResponse.json({
      configured: {
        jsearch: !!config.jsearchApiKey || !!process.env.JSEARCH_API_KEY,
        gemini: !!config.geminiApiKey || !!process.env.GEMINI_API_KEY,
        openrouter: !!config.openrouterApiKey || !!process.env.OPENROUTER_API_KEY,
        nim: !!config.nimApiKey || !!process.env.NIM_API_KEY,
      },
      activeProvider,
      // Values are intentionally NOT included — the server reads them directly
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to read config',
      },
      { status: 500 },
    );
  }
}
