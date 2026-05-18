/**
 * AI Provider Configuration
 *
 * Supports multiple AI providers for profile extraction:
 * - Gemini (Google) — default
 * - OpenRouter — unified API for many models
 * - NIM (NVIDIA NIM) — NVIDIA's inference microservices
 *
 * Priority order when multiple keys are available:
 * 1. Explicit provider + apiKey passed in request
 * 2. Server config store (saved via Settings UI → data/config.json)
 * 3. GEMINI_API_KEY env var
 * 4. OPENROUTER_API_KEY env var
 * 5. NIM_API_KEY env var
 */

import { getApiKey } from '@/lib/config/store';

export type AIProvider = 'gemini' | 'openrouter' | 'nim';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
}

/**
 * Detects which AI provider to use based on available credentials.
 * Priority: explicit config → server config store → env vars.
 */
export async function detectProvider(explicit?: {
  provider?: string;
  apiKey?: string;
}): Promise<AIProviderConfig | null> {
  // 1. Explicit provider + key passed from client
  if (explicit?.provider && explicit?.apiKey) {
    return {
      provider: explicit.provider as AIProvider,
      apiKey: explicit.apiKey,
    };
  }

  // 2. Check server config store (persisted via Settings UI)
  try {
    const geminiKey = await getApiKey('geminiApiKey');
    if (geminiKey) return { provider: 'gemini', apiKey: geminiKey };

    const openrouterKey = await getApiKey('openrouterApiKey');
    if (openrouterKey) return { provider: 'openrouter', apiKey: openrouterKey };

    const nimKey = await getApiKey('nimApiKey');
    if (nimKey) return { provider: 'nim', apiKey: nimKey };
  } catch {
    // Config store not available — fall through to env vars
  }

  // 3. Check environment variables
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return { provider: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY };
  }
  if (process.env.NIM_API_KEY) {
    return { provider: 'nim', apiKey: process.env.NIM_API_KEY };
  }

  return null;
}

/**
 * Call an AI model with the given provider and prompt.
 * Returns the text response.
 */
export async function callAI(prompt: string, config: AIProviderConfig): Promise<string> {
  switch (config.provider) {
    case 'gemini':
      return callGemini(prompt, config.apiKey);
    case 'openrouter':
      return callOpenRouter(prompt, config.apiKey);
    case 'nim':
      return callNIM(prompt, config.apiKey);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

/**
 * Call OpenRouter API (OpenAI-compatible)
 */
async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://seahorse.app',
      'X-Title': 'Seahorse Jobs',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * Call NVIDIA NIM API (OpenAI-compatible)
 */
async function callNIM(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`NIM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}
