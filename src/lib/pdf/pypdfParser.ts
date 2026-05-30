/**
 * pypdf Parser Module
 *
 * Provides PDF text extraction using Python's pypdf library via subprocess.
 * pypdf is a pure-Python, lightweight PDF library that handles text extraction
 * well for digital PDFs.
 *
 * SETUP:
 *   pip install -r scrapers/requirements.txt   # Includes pypdf
 *   # That's it! No Docker, no env vars needed.
 *
 * FALLBACK:
 *   If pypdf is unavailable or fails, falls back to pdf-parse (JavaScript).
 */

import { PDFUploadResult } from '../../types/pdf';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import crypto from 'crypto';
import { parsePDFWithPdfJs } from './pdfParser';

// ─── Configuration ──────────────────────────────────────────────────────────

const PYPDF_SCRIPT = path.join(process.cwd(), 'scripts', 'pypdf_extract.py');
const PYPDF_TIMEOUT_MS = 30_000;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PypdfExtractResponse {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer using pypdf via Python subprocess.
 * Falls back to pdf-parse if pypdf is unavailable.
 */
export async function parsePDF(buffer: Buffer): Promise<PDFUploadResult> {
  // 1. Try pypdf subprocess
  try {
    const result = await trySubprocess(buffer);
    if (result.success && result.text) {
      return {
        success: true,
        text: result.text,
        pageCount: result.pageCount,
      };
    }
    if (result.error) {
      console.warn(`[PypdfParser] Subprocess error: ${result.error}`);
    }
  } catch (err) {
    console.warn('[PypdfParser] Python subprocess unavailable, using pdf-parse fallback...');
  }

  // 2. Fallback to pdf-parse
  return parsePDFWithPdfJs(buffer);
}

/**
 * Check if pypdf is available (via subprocess).
 */
export async function checkPypdfAvailability(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  try {
    execSync('python -c "from pypdf import PdfReader; print(PdfReader.__module__)"', {
      timeout: 5000,
      stdio: 'pipe',
    });
    return { available: true, version: 'installed' };
  } catch {
    return { available: false, error: 'pypdf not installed. Run: pip install pypdf' };
  }
}

// ─── Python Subprocess Mode ──────────────────────────────────────────────

/**
 * Run pypdf extraction via direct Python subprocess.
 * Writes the PDF buffer to a temp file, runs the script, returns the result.
 */
async function trySubprocess(buffer: Buffer): Promise<PypdfExtractResponse> {
  if (!buffer || buffer.length === 0) {
    return { success: false, text: '', pageCount: 0, error: 'Empty buffer' };
  }

  // Verify the Python script exists
  if (!fs.existsSync(PYPDF_SCRIPT)) {
    return { success: false, text: '', pageCount: 0, error: `Script not found: ${PYPDF_SCRIPT}` };
  }

  // Write buffer to temp file
  const tmpDir = os.tmpdir();
  const tmpName = `pypdf_${crypto.randomUUID()}.pdf`;
  const tmpPath = path.join(tmpDir, tmpName);

  try {
    fs.writeFileSync(tmpPath, buffer);

    // Run the Python extraction script
    const stdout = execSync(`python "${PYPDF_SCRIPT}" "${tmpPath}"`, {
      timeout: PYPDF_TIMEOUT_MS,
      stdio: 'pipe',
    });

    const result: PypdfExtractResponse = JSON.parse(stdout.toString().trim());
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Subprocess execution failed';
    return { success: false, text: '', pageCount: 0, error: msg };
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup
    }
  }
}
