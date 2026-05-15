/**
 * Side-by-side comparison: Gemini AI extraction vs keyword fallback.
 *
 * Generates the same CV PDF, processes it through both extraction paths,
 * and prints a structured comparison of results.
 *
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/compare-extraction-methods.ts
 */

import * as fs from "fs";
import * as path from "path";
import { extractProfileFromPDF } from "../src/lib/ai";

// ── Multi-line PDF Generator (same as test-profile-extraction.ts) ────────
function createMultiLinePDF(lines: string[]): Buffer {
  const escapePDFString = (s: string): string =>
    s.replace(/\\/g, "\\\\")
     .replace(/\(/g, "\\(")
     .replace(/\)/g, "\\)");

  let streamData = "";
  let y = 750;
  for (const line of lines) {
    streamData += `BT /F1 10 Tf 50 ${y} Td (${escapePDFString(line)}) Tj ET\n`;
    y -= 14;
  }

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`,
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamData, "utf-8")} >>\nstream\n${streamData}\nendstream\nendobj`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
  ];

  let output = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(output.length);
    output += `${obj}\n`;
  }

  const xrefOffset = output.length;
  output += "xref\n";
  output += `0 ${objects.length + 1}\n`;
  output += `${"0000000000"} 65535 f \n`;
  for (const offset of offsets) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += "trailer\n";
  output += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += "startxref\n";
  output += `${xrefOffset}\n`;
  output += "%%EOF\n";

  return Buffer.from(output, "latin1");
}

// ── Sample CV Data ───────────────────────────────────────────────────────
const CV_LINES = [
  "Juan Perez",
  "Senior Software Engineer & Tech Lead",
  "",
  "EXPERIENCE",
  "",
  "TechCorp Inc.  -  Senior Software Engineer  (2020-Present)",
  "  - Led a team of 5 engineers building microservices with Node.js, TypeScript, and AWS",
  "  - Designed event-driven architecture using Kafka and PostgreSQL",
  "  - Reduced API latency by 40% through query optimization and caching",
  "",
  "StartupXYZ  -  Full Stack Developer  (2017-2020)",
  "  - Built React dashboard with real-time data visualization using D3.js",
  "  - Developed RESTful APIs with Express.js and MongoDB",
  "  - Implemented CI/CD pipelines with Docker and GitHub Actions",
  "",
  "ByteForge  -  Junior Developer  (2015-2017)",
  "  - Contributed to Python-based data processing pipelines",
  "  - Built internal tools with Flask and PostgreSQL",
  "",
  "EDUCATION",
  "",
  "Master's in Computer Science  -  Universidad de los Andes  (2013-2015)",
  "Bachelor's in Systems Engineering  -  Universidad Nacional  (2008-2013)",
  "",
  "SKILLS",
  "",
  "Languages: TypeScript, JavaScript, Python, SQL, Go",
  "Frontend: React, Next.js, HTML/CSS, Tailwind",
  "Backend: Node.js, Express, NestJS, GraphQL",
  "Cloud & DevOps: AWS (EC2, Lambda, S3, RDS), Docker, Kubernetes, CI/CD",
  "Databases: PostgreSQL, MongoDB, Redis, Elasticsearch",
  "Other: Kafka, RabbitMQ, Git, Agile/Scrum",
  "",
  "CERTIFICATIONS",
  "  - AWS Solutions Architect  -  Associate",
  "  - Google Cloud Developer",
  "",
  "LANGUAGES",
  "  - Spanish (Native)",
  "  - English (Fluent, C1)",
  "  - German (Intermediate, B1)",
  "",
  "LOCATION",
  "Bogota, Colombia (Open to remote work worldwide)",
  "",
  "SALARY EXPECTATION",
  "$80,000  -  $120,000 USD",
];

// ── Field comparison helper ──────────────────────────────────────────────
function compareField(label: string, gemini: unknown, keyword: unknown): void {
  const g = JSON.stringify(gemini) || "(none)";
  const k = JSON.stringify(keyword) || "(none)";
  const match = g === k ? "  ✓" : "  ✗";
  console.log(`  ${label.padEnd(22)} Gemini: ${g.padEnd(55)} Keyword: ${k}  ${match}`);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(100));
  console.log("  AI PDF Profile Extraction — Gemini vs Keyword Fallback Comparison");
  console.log("=".repeat(100));

  // Step 1: Generate PDF
  console.log("\n[1/4] Generating sample PDF...");
  const pdfBuffer = createMultiLinePDF(CV_LINES);
  const tempPath = path.join(__dirname, "..", "temp-test-cv.pdf");
  fs.writeFileSync(tempPath, pdfBuffer);
  console.log(`  PDF created (${pdfBuffer.length} bytes)`);

  // Step 2: Extract text for reference
  console.log("\n[2/4] Extracting text from PDF...");
  const { parsePDF } = await import("../src/lib/pdf/pdfParser");
  const pdfTextResult = await parsePDF(pdfBuffer);
  const rawText = pdfTextResult.success ? pdfTextResult.text : "(extraction failed)";
  console.log(`  Raw text length: ${rawText.length} chars`);

  // Step 3: Run Gemini AI extraction
  console.log("\n[3/4] Running Gemini AI extraction...");
  let geminiResult, geminiTime: number;
  try {
    const t0 = Date.now();
    geminiResult = await extractProfileFromPDF(pdfBuffer);
    geminiTime = Date.now() - t0;
    console.log(`  Completed in ${geminiTime}ms — ${geminiResult.success ? "OK" : "FAILED"}`);
    if (!geminiResult.success) {
      console.log(`  Error: ${geminiResult.error}`);
    }
  } catch (err: any) {
    geminiResult = { success: false, error: err.message };
    geminiTime = -1;
    console.log(`  FAILED: ${err.message}`);
  }

  // Step 4: Run keyword fallback extraction
  console.log("\n[4/4] Running keyword fallback extraction...");
  let keywordResult, keywordTime: number;
  try {
    const t0 = Date.now();
    keywordResult = await extractProfileFromPDF(pdfBuffer, { provider: "keyword" });
    keywordTime = Date.now() - t0;
    console.log(`  Completed in ${keywordTime}ms — ${keywordResult.success ? "OK" : "FAILED"}`);
    if (!keywordResult.success) {
      console.log(`  Error: ${keywordResult.error}`);
    }
  } catch (err: any) {
    keywordResult = { success: false, error: err.message };
    keywordTime = -1;
    console.log(`  FAILED: ${err.message}`);
  }

  // ── Comparison Report ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(100));
  console.log("  COMPARISON RESULTS");
  console.log("=".repeat(100));
  console.log();
  console.log(`  Duration:          Gemini ${geminiTime > 0 ? `${geminiTime}ms` : "N/A"}          Keyword ${keywordTime > 0 ? `${keywordTime}ms` : "N/A"}`);
  console.log();

  const gP = geminiResult.success ? geminiResult.profile! : null;
  const kP = keywordResult.success ? keywordResult.profile! : null;

  if (!gP && !kP) {
    console.log("  Both methods failed. No comparison available.");
    process.exit(1);
  }

  // Compare each field
  console.log("  ── Core Fields ──────────────────────────────────────────────────────────────────────");
  console.log();
  compareField("Job Titles", gP?.jobTitles ?? [], kP?.jobTitles ?? []);
  compareField("Experience Level", gP?.experienceLevel ?? "?", kP?.experienceLevel ?? "?");
  compareField("Skills (count)", gP?.skills?.length ?? 0, kP?.skills?.length ?? 0);
  compareField("Skills (first 10)", gP?.skills?.slice(0, 10) ?? [], kP?.skills?.slice(0, 10) ?? []);
  compareField("Industries", gP?.industries ?? [], kP?.industries ?? []);
  compareField("Locations", gP?.locations ?? [], kP?.locations ?? []);
  compareField("Salary Range", gP?.salaryRange ?? null, kP?.salaryRange ?? null);
  compareField("Languages", gP?.languages ?? [], kP?.languages ?? []);
  compareField("Summary (first 80)", gP?.summary?.substring(0, 80) ?? "", kP?.summary?.substring(0, 80) ?? "");
  console.log();

  // Show Gemini full summary
  if (gP?.summary) {
    console.log("  ── Gemini Summary ──────────────────────────────────────────────────────────────────");
    console.log(`  ${gP.summary}`);
    console.log();
  }

  // Score: count matching fields
  let matched = 0;
  let total = 0;
  const fieldsToCompare = [
    ["jobTitles", JSON.stringify(gP?.jobTitles ?? []), JSON.stringify(kP?.jobTitles ?? [])],
    ["experienceLevel", gP?.experienceLevel ?? "", kP?.experienceLevel ?? ""],
    ["skills (first 5)", JSON.stringify(gP?.skills?.slice(0, 5) ?? []), JSON.stringify(kP?.skills?.slice(0, 5) ?? [])],
    ["locations", JSON.stringify(gP?.locations ?? []), JSON.stringify(kP?.locations ?? [])],
    ["industries", JSON.stringify(gP?.industries ?? []), JSON.stringify(kP?.industries ?? [])],
    ["salaryRange", JSON.stringify(gP?.salaryRange ?? null), JSON.stringify(kP?.salaryRange ?? null)],
  ];
  for (const [, g, k] of fieldsToCompare) {
    total++;
    if (g === k) matched++;
  }

  // Show comparison by methods (AI can extract things keyword can't and vice versa)
  console.log("  ── Qualitative Assessment ────────────────────────────────────────────────────────────");
  console.log();

  // Gemini-specific strengths
  const geminiAdvantages: string[] = [];
  if (gP?.summary && !kP?.summary) geminiAdvantages.push("Generates a natural language summary");
  if ((gP?.skills?.length ?? 0) > (kP?.skills?.length ?? 0)) geminiAdvantages.push("Extracts more skills");
  if ((gP?.industries?.length ?? 0) > (kP?.industries?.length ?? 0)) geminiAdvantages.push("Identifies industries");
  if (gP?.languages?.length && !kP?.languages?.length) geminiAdvantages.push("Extracts languages with proficiency levels");

  const keywordAdvantages: string[] = [];
  if ((kP?.skills?.length ?? 0) >= (gP?.skills?.length ?? 0) && (kP?.skills?.length ?? 0) > 0) keywordAdvantages.push("Matches or beats AI on skill count (no API needed)");
  if (JSON.stringify(kP?.salaryRange) === JSON.stringify(gP?.salaryRange)) keywordAdvantages.push("Matches AI on salary parsing");
  if (JSON.stringify(kP?.jobTitles) === JSON.stringify(gP?.jobTitles)) keywordAdvantages.push("Matches AI on job title extraction");

  if (geminiAdvantages.length > 0) {
    console.log("  Gemini AI Advantages:");
    geminiAdvantages.forEach((a) => console.log(`    + ${a}`));
  } else {
    console.log("  Gemini AI: No unique advantages detected in this run.");
  }

  if (keywordAdvantages.length > 0) {
    console.log("  Keyword Fallback Advantages:");
    keywordAdvantages.forEach((a) => console.log(`    + ${a}`));
  } else {
    console.log("  Keyword Fallback: No unique advantages detected in this run.");
  }

  console.log();
  console.log("  Fields matching:  ".padEnd(30) + `${matched}/${total}`);
  console.log("  Gemini speed:     ".padEnd(30) + `${geminiTime > 0 ? `${geminiTime}ms` : "N/A"}`);
  console.log("  Keyword speed:    ".padEnd(30) + `${keywordTime > 0 ? `${keywordTime}ms` : "N/A"}`);

  // Cleanup
  try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

  console.log("\n" + "=".repeat(100));
  console.log("  ✅ Comparison complete!");
  console.log("=".repeat(100));
}

main().catch((err) => {
  console.error("\n  ❌ Test failed:", err.message);
  process.exit(1);
});
