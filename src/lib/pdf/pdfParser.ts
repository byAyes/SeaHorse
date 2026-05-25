/**
 * PDF Parser Module
 * Extracts text content from PDF documents using pdf-parse library
 */

import { PDFParse } from 'pdf-parse';
import { PDFUploadResult } from '../../types/pdf.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// ── pdf.js Worker Configuration ────────────────────────────────────────────
// In Next.js/Turbopack, the pdf.js worker isn't automatically bundled.
// We configure it explicitly using the worker file copied to public/.
const PDF_WORKER_PATH = path.join(process.cwd(), 'public', 'pdf.worker.mjs');
if (fs.existsSync(PDF_WORKER_PATH)) {
  PDFParse.setWorker(pathToFileURL(PDF_WORKER_PATH).href);
} else {
  console.warn(
    '[PDFParser] pdf.worker.mjs not found in public/ — PDF extraction may fail in Next.js. Run: cp node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs public/pdf.worker.mjs',
  );
}

/**
 * Parse a PDF buffer and extract text content
 * @param buffer - PDF file as Buffer
 * @returns Promise resolving to PDFUploadResult with extracted text and metadata
 */
export async function parsePDF(buffer: Buffer): Promise<PDFUploadResult> {
  let parser: PDFParse | null = null;
  try {
    // Create PDF parser instance
    parser = new PDFParse({ data: buffer });

    // Load the PDF document
    // The load() method exists at runtime but is typed as private
    await (parser as unknown as { load: () => Promise<void> }).load();

    // Extract text from all pages (use newline as page separator)
    const textResult = await parser.getText({ pageJoiner: '\n' });
    const text = textResult.text;
    const pageCount = textResult.total;

    // Clean extracted text: normalize whitespace and line breaks
    const cleanedText = cleanText(text);

    return {
      success: true,
      text: cleanedText,
      pageCount: pageCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing PDF';
    return {
      success: false,
      text: '',
      pageCount: 0,
      error: errorMessage,
    };
  } finally {
    // Clean up resources
    parser?.destroy();
  }
}

/**
 * Clean extracted text by normalizing whitespace and line breaks
 * @param text - Raw text extracted from PDF
 * @returns Cleaned text with normalized whitespace
 */
function cleanText(text: string): string {
  return (
    text
      // Replace multiple newlines with double newline
      .replace(/\n\s*\n/g, '\n\n')
      // Replace multiple spaces with single space
      .replace(/ +/g, ' ')
      // Remove spaces around newlines
      .replace(/\n +/g, '\n')
      .replace(/ +\n/g, '\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Final trim
      .trim()
  );
}
