/**
 * Server-side configuration store
 *
 * Persists API keys and other sensitive config to a local JSON file
 * (`data/config.json`). This replaces the insecure pattern of storing
 * API keys in localStorage on the client.
 *
 * The store is backed by disk so it survives server restarts.
 * Keys saved here are merged with (and take precedence over) process.env.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// ── Paths ──

const DATA_DIR = join(process.cwd(), 'data');
const CONFIG_PATH = join(DATA_DIR, 'config.json');

// ── Types ──

export interface ServerConfig {
  jsearchApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  nimApiKey?: string;
}

// ── Helpers ──

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── Public API ──

/**
 * Load the full config from disk.
 * Returns an empty object if the file doesn't exist yet.
 */
export async function loadConfig(): Promise<ServerConfig> {
  try {
    ensureDataDir();
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as ServerConfig;
  } catch {
    return {};
  }
}

/**
 * Save (merge) partial config values to disk.
 * Only the provided keys are updated — existing keys are preserved.
 */
export async function saveConfig(partial: Partial<ServerConfig>): Promise<ServerConfig> {
  ensureDataDir();
  const existing = await loadConfig();
  const merged = { ...existing, ...partial };
  // Remove undefined values so they don't get written as "null"
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cleaned, null, 2), 'utf-8');
  return cleaned as unknown as ServerConfig;
}

/**
 * Check whether at least one AI API key is configured on the server.
 * Returns the provider name of the first found key, or null.
 */
export async function getActiveAiProvider(): Promise<string | null> {
  const config = await loadConfig();
  if (config.geminiApiKey) return 'gemini';
  if (config.openrouterApiKey) return 'openrouter';
  if (config.nimApiKey) return 'nim';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.NIM_API_KEY) return 'nim';
  return null;
}

/**
 * Get a specific API key from the store, falling back to process.env.
 */
export async function getApiKey(key: keyof ServerConfig): Promise<string | undefined> {
  const config = await loadConfig();
  const storedValue = config[key];
  if (storedValue) return storedValue;

  // Fallback to environment variable
  const envMap: Record<keyof ServerConfig, string | undefined> = {
    jsearchApiKey: process.env.JSEARCH_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    nimApiKey: process.env.NIM_API_KEY,
  };
  return envMap[key];
}
