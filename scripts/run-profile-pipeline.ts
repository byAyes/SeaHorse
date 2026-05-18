/**
 * End-to-End Profile Pipeline Test
 *
 * 1. Extract profile from a CV PDF (Gemini AI or keyword fallback)
 * 2. Build search query strategy from the profile
 * 3. Run the full automation pipeline (scrape → filter → email digest)
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/run-profile-pipeline.ts <pdf-path>
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractAndConfigurePipeline } from '../src/lib/ai/runScrapeWithProfile';
import { executePipeline } from '../src/automation/orchestrator';

async function main() {
  // ── Resolve PDF path ────────────────────────────────────────────────────
  const pdfArg = process.argv[2];
  if (!pdfArg) {
    console.error('Usage: npx tsx scripts/run-profile-pipeline.ts <pdf-path>');
    console.error('  Uses temp-hv-juan.pdf as default if no path provided');
  }
  const pdfPath = pdfArg || 'temp-hv-juan.pdf';
  const resolvedPath = path.resolve(pdfPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`PDF not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  📄 CV Profile Pipeline');
  console.log('='.repeat(60));
  console.log(`  PDF: ${resolvedPath}`);
  console.log(`  Size: ${(fs.statSync(resolvedPath).size / 1024).toFixed(1)} KB`);

  // ── Step 1: Extract profile from PDF ─────────────────────────────────────
  console.log('\n' + '-'.repeat(60));
  console.log('  Step 1: Extracting profile from PDF...');
  console.log('-'.repeat(60));

  const pdfBuffer = fs.readFileSync(resolvedPath);
  const startTime = Date.now();

  const profile = await extractAndConfigurePipeline(pdfBuffer);

  if (!profile) {
    console.error('\n❌ Failed to extract profile from PDF');
    process.exit(1);
  }

  const extractionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  ✅ Profile extracted (${extractionTime}s)`);
  console.log(`     Job Titles:   ${profile.jobTitles.join(', ')}`);
  console.log(`     Level:        ${profile.experienceLevel}`);
  console.log(`     Skills:       ${profile.skills.length} identified`);
  console.log(`     Locations:    ${profile.locations.join(', ') || 'N/A'}`);
  console.log(
    `     Languages:    ${profile.languages.map((l) => `${l.language} (${l.level})`).join(', ') || 'N/A'}`,
  );

  // ── Step 2: Show search strategy ──────────────────────────────────────────
  console.log('\n' + '-'.repeat(60));
  console.log('  Step 2: Search strategy');
  console.log('-'.repeat(60));

  const jobQuery = process.env.JOB_QUERY || '(not set)';
  const jobLocation = process.env.JOB_LOCATION || '(not set)';
  console.log(`  JOB_QUERY:    ${jobQuery}`);
  console.log(`  JOB_LOCATION: ${jobLocation}`);
  console.log(`  EMAIL_TO:     ${process.env.GMAIL_RECIPIENT || '(not set)'}`);

  // ── Step 3: Run the automation pipeline ──────────────────────────────────
  console.log('\n' + '-'.repeat(60));
  console.log('  Step 3: Running automation pipeline (scrape → filter → email)...');
  console.log('-'.repeat(60));

  const pipelineStart = Date.now();

  const result = await executePipeline(profile);

  const pipelineTime = ((Date.now() - pipelineStart) / 1000).toFixed(1);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Results ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Scraped:  ${result.scraped} jobs`);
  console.log(`  New:      ${result.matched} jobs`);
  console.log(`  Emailed:  ${result.sent} jobs`);
  console.log(`  Cleaned:  ${result.cleaned} old records`);
  console.log('');
  console.log(`  Extraction:  ${extractionTime}s`);
  console.log(`  Pipeline:    ${pipelineTime}s`);
  console.log(`  Total:       ${totalTime}s`);

  if (result.scraperStats?.length) {
    console.log('');
    console.log('  Scraper stats:');
    for (const stat of result.scraperStats) {
      const status = stat.success ? '✅' : '❌';
      const detail = stat.error ? ` (${stat.error})` : '';
      console.log(
        `    ${status} ${stat.scraper}: ${stat.jobCount} jobs in ${(stat.duration / 1000).toFixed(1)}s${detail}`,
      );
    }
  }

  if (result.sent > 0) {
    console.log(`\n  📧 Email sent to ${process.env.GMAIL_RECIPIENT}`);
  } else if (result.matched > 0) {
    console.log('\n  ⚠️  Jobs found but email not sent (check email config)');
  } else {
    console.log('\n  ℹ️  No new jobs found this run');
  }
}

main().catch((error) => {
  console.error('\n❌ Pipeline failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
