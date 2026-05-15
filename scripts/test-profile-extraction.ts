/**
 * End-to-end test for AI PDF Profile Extraction.
 *
 * Generates a minimal valid PDF with CV content (multi-line layout),
 * processes it through the extraction pipeline (keyword fallback),
 * and reports results.
 *
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/test-profile-extraction.ts
 */

import * as fs from "fs";
import * as path from "path";
import { extractProfileFromPDF } from "../src/lib/ai";

// ── Multi-line PDF Generator ──────────────────────────────────────────────
// Each line is rendered at a descending Y position so pdf-parse v2
// can extract all text content correctly.
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

// ── Sample CV Lines (one per array element = one PDF line) ──────────────
const CV_LINES = [
  "Juan Perez",
  "Senior Software Engineer & Tech Lead",
  "",
  "EXPERIENCE",
  "",
  "TechCorp Inc.  —  Senior Software Engineer  (2020–Present)",
  "  - Led a team of 5 engineers building microservices with Node.js, TypeScript, and AWS",
  "  - Designed event-driven architecture using Kafka and PostgreSQL",
  "  - Reduced API latency by 40% through query optimization and caching",
  "",
  "StartupXYZ  —  Full Stack Developer  (2017–2020)",
  "  - Built React dashboard with real-time data visualization using D3.js",
  "  - Developed RESTful APIs with Express.js and MongoDB",
  "  - Implemented CI/CD pipelines with Docker and GitHub Actions",
  "",
  "ByteForge  —  Junior Developer  (2015–2017)",
  "  - Contributed to Python-based data processing pipelines",
  "  - Built internal tools with Flask and PostgreSQL",
  "",
  "EDUCATION",
  "",
  "Master's in Computer Science  —  Universidad de los Andes  (2013–2015)",
  "Bachelor's in Systems Engineering  —  Universidad Nacional  (2008–2013)",
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
  "  - AWS Solutions Architect  —  Associate",
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
  "$80,000  –  $120,000 USD",
];

// ── Test Runner ───────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  AI PDF Profile Extraction — End-to-End Test");
  console.log("=".repeat(60));

  // Step 1: Generate a minimal PDF (multi-line layout)
  console.log("\n[1/4] Generating sample PDF with CV content...");
  const pdfBuffer = createMultiLinePDF(CV_LINES);
  const tempPath = path.join(__dirname, "..", "temp-test-cv.pdf");
  fs.writeFileSync(tempPath, pdfBuffer);
  console.log(`  ✓ PDF created (${pdfBuffer.length} bytes) → ${path.basename(tempPath)}`);

  // Step 2: Run profile extraction
  console.log("\n[2/4] Running profile extraction...");
  const startTime = Date.now();
  const result = await extractProfileFromPDF(pdfBuffer);
  const elapsed = Date.now() - startTime;
  console.log(`  ✓ Extraction completed in ${elapsed}ms`);

  if (!result.success) {
    console.error(`\n  ✗ Extraction failed: ${result.error}`);
    process.exit(1);
  }

  // Step 3: Report extracted profile
  console.log("\n[3/4] Extracted Profile Results:");
  const p = result.profile!;
  console.log("─".repeat(60));
  console.log(`  Job Titles:        ${p.jobTitles.join("  |  ") || "(none)"}`);
  console.log(`  Skills (${p.skills.length}):         ${p.skills.slice(0, 16).join(", ") || "(none)"}${p.skills.length > 16 ? "..." : ""}`);
  console.log(`  Industries:        ${p.industries.join(", ") || "(none)"}`);
  console.log(`  Locations:         ${p.locations.join(", ") || "(none)"}`);
  console.log(`  Experience Level:  ${p.experienceLevel}`);
  console.log(`  Salary Range:      ${p.salaryRange ? `${p.salaryRange.min || "?"} – ${p.salaryRange.max || "?"} ${p.salaryRange.currency || ""}` : "N/A"}`);
  console.log(`  Languages:         ${p.languages.map((l: { language: string; level?: string }) => `${l.language} (${l.level || "?"})`).join(", ") || "(none)"}`);
  console.log(`  Summary:           ${p.summary ? p.summary.substring(0, 150) + "..." : "N/A"}`);
  console.log("─".repeat(60));

  // Step 4: Generate scrape strategy from profile
  console.log("\n[4/4] Generating scrape strategy...");
  const { buildScrapeStrategy, getCombinedQueries } = await import("../src/lib/ai");
  const strategy = buildScrapeStrategy(p);
  console.log(`  Search Queries (${strategy.searchQueries.length}):`);
  strategy.searchQueries.forEach((q: string, i: number) => console.log(`    ${i + 1}. "${q}"`));
  console.log(`  Locations:         ${strategy.locations.join(", ") || "(any)"}`);
  console.log(`  Priority Sources:  ${strategy.prioritizedSources.join(", ")}`);
  console.log(`  Experience Filter: ${strategy.experienceLevel}`);
  console.log(`  Combined Query:    "${getCombinedQueries(strategy)}"`);

  // Cleanup
  try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ Test complete! Extraction pipeline works.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\n  ❌ Test failed:", err.message);
  process.exit(1);
});
