# Seahorse — Job Email Automation

## Project Skills

> 📖 **Always read `AGENTS.md` in the project root** — it defines:
>
> 1. The active skills table
> 2. A comprehensive **Skill-to-Task Mapping** section covering frontend, backend, testing,
>    scraping, CI/CD, security, code quality, and documentation tasks
>
> **Before starting any task, check AGENTS.md → Skill-to-Task Mapping** to find
> which skill to load for your specific domain. The mapping table tells you exactly
> which skill to load and why.

## What This Is

Automated job board scraper → AI profile extraction → AI matcher → email digest pipeline. Upload a CV/PDF, it extracts your profile via Gemini AI, scrapes 5+ sources, scores jobs with weighted matching, and sends a beautiful HTML email with emojis and real match scores.

**Fallback layer:** When primary scrapers fail (LinkedIn blocked, Indeed intermittent), Jina Reader headless Chrome automatically rescues job listings.

---

## Quick Reference

### Commands

| Command                                                                              | Purpose                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `npx tsx scripts/run-profile-pipeline.ts path/to/cv.pdf`                             | Full pipeline: extract profile → scrape → score → email                          |
| `npm run automate`                                                                   | Basic pipeline (scrape → email, no profile extraction)                           |
| `npx tsx src/scrapers/index.ts "query" 5`                                            | Pipeline CLI with JinaReader fallback                                            |
| `JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "query" 5` | Pipeline with self-hosted Jina Reader                                            |
| `npx tsx src/scrapers/strategies/jinaReader.ts <source> "query" 10`                  | Test Jina Reader standalone (sources: linkedin, indeed, computrabajo, glassdoor) |
| `docker compose up -d jina-reader`                                                   | Start self-hosted Jina Reader                                                    |
| `docker compose logs --tail=50 jina-reader`                                          | View Jina Reader logs                                                            |
| `npm run dev`                                                                        | Start Next.js dev server                                                         |
| `npm test`                                                                           | Run all tests (109, 6 suites)                                                    |
| `npx tsx scripts/test-email.ts`                                                      | Test email sending (HTML)                                                        |
| `npx tsx scripts/test-matching.ts`                                                   | Test matching engine                                                             |
| `pip install -r scrapers/requirements.txt`                                           | Install Python scraper deps                                                      |
| `playwright install chromium`                                                        | Install browser for Scrapling                                                    |
| `patchright install chromium`                                                        | Install patched browser for Scrapling                                            |

---

## Key Code Locations

| Component               | Location                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| Pipeline (with profile) | `scripts/run-profile-pipeline.ts` → `src/automation/orchestrator.ts`          |
| Pipeline (basic)        | `src/automation/scheduler.ts` → `src/automation/orchestrator.ts`              |
| AI Profile Extraction   | `src/lib/ai/pdfProfileExtractor.ts` (Gemini + keyword fallback)               |
| Scrape Strategy Builder | `src/lib/ai/scrapeStrategy.ts`                                                |
| ScraperRunner           | `src/scrapers/index.ts` (orchestrates all scrapers + JinaReader fallback)     |
| JinaReader Fallback     | `src/scrapers/strategies/jinaReader.ts` (headless Chrome for blocked sources) |
| Python scrapers         | `scrapers/*.py` + bridge `src/scrapers/bridge/pythonBridge.ts`                |
| Matching                | `src/matching/` (scorer, skill, location, salary, interest)                   |
| Email                   | `src/lib/email/` (SMTP/Resend/SendGrid/Gmail providers)                       |
| Email Template          | `src/lib/email/template.ts` (Premium HTML + emojis + scores)                  |
| Scraper config          | `scrapers.yaml`                                                               |
| Docker config           | `docker-compose.yml`                                                          |

---

## Architecture Notes

- **TypeScript (CommonJS)** with `tsx` runtime
- **AI Extraction**: Gemini Flash (`gemini-2.0-flash`). Falls back to keyword extraction if API key not set.
- **Email**: SMTP (Gmail App Password) is the **default** provider. Resend, Gmail API, SendGrid as alternatives.
  - Provider routing reads `EMAIL_PROVIDER` env var at call time (lazy init).
  - SMTP was fixed to properly pass `html` and `cc` to nodemailer.
- **Python scrapers**: Spawned as subprocesses via `pythonBridge.ts`. Use Scrapling library.
- **Matching**: Weighted scoring (Skills 40% / Interests 30% / Location 20% / Salary 10%) — **real scores, no fake 100%**.
- **Email template**: Premium HTML with emojis (📬📊🎯🔥🚀), SVG icons, score badges, stats cards, empty state.
- **Storage**: Local JSON files (`data/`) — no database required, zero config.

---

## Jina Reader — Headless Chrome Fallback Scraper

Jina Reader (`src/scrapers/strategies/jinaReader.ts`) uses a headless Chrome API to extract job listings as fallback when direct scrapers fail. Key design:

### Integration with ScraperRunner (Fallback Flow)

When `JINA_READER_BASE_URL` is set, `ScraperRunner` (`src/scrapers/index.ts`) automatically:

1. **Runs primary scrapers** (JSearch API, Python Scrapling)
2. **Calls `identifyFailedSources()`** — analyzes which scrapers returned 0 jobs
3. **Fires `runJinaReaderFallbacks()`** — for each failed source, runs JinaReaderScraper with same query
4. **Deduplicates** results against already-collected jobs (by `title|company` key)
5. **Records stats** for each fallback attempt (success/failure, job count, duration)

### Supported Sources

| Source       | Cloud (r.jina.ai)    | Self-hosted (Docker) | Notes                                        |
| ------------ | -------------------- | -------------------- | -------------------------------------------- |
| LinkedIn     | ❌ 451 (TOS blocked) | ✅ 10 jobs           | Primary target — reliably works via Docker   |
| Indeed       | ❌ 403 (Cloudflare)  | ⚠️ 2 jobs, mixed     | Format differs between cloud and self-hosted |
| Computrabajo | ✅ Works             | ✅ 6+ jobs           | Full salary extraction                       |
| Glassdoor    | ⚠️ Rate-limited      | ✅ Works             | Salaries + ratings                           |

### Parsers

Each source has a dedicated parser with multiple fallback strategies:

| Source       | Parser Function               | Strategies                                                       |
| ------------ | ----------------------------- | ---------------------------------------------------------------- |
| LinkedIn     | `parseLinkedInMarkdown()`     | 3: heading blocks → bullet lists → self-hosted format            |
| Indeed       | `parseIndeedMarkdown()`       | 3: heading blocks → bullet lists → self-hosted heading+next-line |
| Computrabajo | `parseComputrabajoMarkdown()` | 1: heading blocks with positional extraction (Spanish)           |
| Glassdoor    | `parseGlassdoorMarkdown()`    | 2: heading blocks → bullet lists                                 |

### Self-Hosting with Docker

Self-hosting bypasses Jina Reader's free-tier rate limits and LinkedIn/Indeed TOS blocks.

```bash
# Start the container
docker compose up -d jina-reader

# Test with self-hosted instance
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 10

# Run full pipeline with fallback
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "desarrollador" 5
```

**Docker Compose** (`docker-compose.yml`):

```yaml
services:
  jina-reader:
    image: ghcr.io/jina-ai/reader:oss
    container_name: seahorse-jina-reader
    ports:
      - '3001:8081' # HTTP/1.1 — use with regular curl/axios
    environment:
      - CHROMIUM_FLAGS=--no-sandbox # Required for Puppeteer in Docker
    cap_add: [SYS_ADMIN]
    security_opt: [seccomp=unconfined, apparmor=unconfined]
```

**Docker port mapping:** HTTP/1.1 fallback on port **3001** — use with regular `curl`/`axios`. HTTP/2 on port 3000.

### Test Results

| Suite                                        | Tests  | Result      |
| -------------------------------------------- | ------ | ----------- |
| Unit tests (jinaReader.test.ts)              | 19     | ✅ All pass |
| Integration (jinaReader.integration.test.ts) | 40     | ✅ All pass |
| **Total Jina Reader**                        | **59** | ✅          |

| Endpoint / Test                       | Result | Detail                                     |
| ------------------------------------- | ------ | ------------------------------------------ |
| `r.jina.ai` → Computrabajo (cloud)    | ✅     | 5 jobs, rate-limit recoverable             |
| `r.jina.ai` → Glassdoor (cloud)       | ⚠️     | Rate-limited, OK with self-host            |
| `r.jina.ai` → LinkedIn (cloud)        | ❌ 451 | Blocked legally by Jina Reader             |
| `r.jina.ai` → Indeed (cloud)          | ❌ 403 | Cloudflare challenge                       |
| **Self-hosted Docker** → Computrabajo | ✅     | 6+ jobs, full salary extraction            |
| **Self-hosted Docker** → LinkedIn     | ✅     | 10 jobs (self-hosted parser), real results |
| **Self-hosted Docker** → Indeed       | ⚠️     | 2 jobs, mixed quality — format differs     |
| **Self-hosted Docker** → Glassdoor    | ✅     | Jobs + salaries + ratings                  |

### Pipeline Self-Hosting Validation

Full pipeline test with self-hosted Jina Reader (`http://localhost:3001`, 2025-05-19):

| Scraper                   | Jobs   | Method                   | Notes                         |
| ------------------------- | ------ | ------------------------ | ----------------------------- |
| Glassdoor                 | 10     | Python Scrapling         | ✅ Full success               |
| Computrabajo              | 10     | Python Scrapling         | ✅ Full success               |
| Indeed                    | 10     | Python Scrapling         | ✅ Intermittent but succeeded |
| JSearch                   | 0      | REST API                 | ❌ 401 (no API key locally)   |
| LinkedIn                  | 0      | Python Scrapling         | ❌ Blocked (expected)         |
| **JinaReader (LinkedIn)** | **1**  | **Self-hosted fallback** | ✅ **Fallback fired!**        |
| **Total**                 | **31** | —                        | Pipeline fully functional     |

> **Key result:** `JINA_READER_BASE_URL` fallback integration works end-to-end. LinkedIn rescued from 0 → 1 job via Jina Reader self-hosted fallback. Database persistence fails locally (Prisma mock), but the scraper layer is validated.

### CI Integration

`JINA_READER_BASE_URL` is configured as an **optional secret** in `.github/workflows/main.yml`. When set, Jina Reader fallback runs automatically. When unset, it's skipped gracefully.

To enable in CI:

1. Deploy Jina Reader Docker container (see Self-Hosting)
2. Set `JINA_READER_BASE_URL` in GitHub repo Secrets
3. The next workflow run uses it automatically

### Computrabajo Configuration

| Env Var                 | Default                              | Description                                       |
| ----------------------- | ------------------------------------ | ------------------------------------------------- |
| `COMPUTRABAJO_COUNTRY`  | `co`                                 | Country code (`co`, `mx`, `ar`, `cl`, `pe`, `ec`) |
| `COMPUTRABAJO_BASE_URL` | `https://{country}.computrabajo.com` | Full base URL override                            |

---

## Email Provider Configuration

### SMTP (default — recommended)

| Env Var           | Value            | Notes                 |
| ----------------- | ---------------- | --------------------- |
| `EMAIL_PROVIDER`  | `smtp`           | This is the default   |
| `SMTP_HOST`       | `smtp.gmail.com` | Gmail SMTP server     |
| `SMTP_PORT`       | `587`            | TLS port              |
| `SMTP_USER`       | email            | Your Gmail address    |
| `SMTP_PASSWORD`   | app password     | Gmail App Password    |
| `SMTP_FROM`       | email            | Sender address        |
| `GMAIL_RECIPIENT` | email            | Recipient for digests |
| `EMAIL_CC`        | email            | Optional CC address   |

### Alternatives

| Env Var             | Value                   | Notes               |
| ------------------- | ----------------------- | ------------------- |
| `EMAIL_PROVIDER`    | `resend`                | Switch to Resend    |
| `RESEND_API_KEY`    | key                     | Resend API key      |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | Free tier sender    |
| `EMAIL_PROVIDER`    | `gmail`                 | Switch to Gmail API |
| `EMAIL_PROVIDER`    | `sendgrid`              | Switch to SendGrid  |

---

## Scraper Performance

| Source         | Method           |     Status      | Jobs/Run  |
| -------------- | ---------------- | :-------------: | :-------: |
| JSearch API    | REST API         | ✅ Always works |    ~10    |
| Computrabajo   | Python Scrapling |   ✅ Reliable   |    ~10    |
| Indeed         | Python Scrapling | ⚠️ Intermittent |   0–10    |
| Glassdoor      | Python Scrapling | ⚠️ Intermittent |   0–10    |
| LinkedIn       | Python Scrapling |   ❌ Blocked    |     0     |
| **JinaReader** | Headless Chrome  | **✅ Fallback** | **+1-10** |

**Total per run:** **~15–31 jobs** — failed scrapers don't crash the pipeline. Jina Reader rescues blocked/failed sources when configured.

---

## Database → Local JSON Storage ✅

**✅ COMPLETED — No external database required.**

The project was refactored from Prisma + Supabase/Neon to **local JSON file storage** (`data/database.json`). Key changes:

- **0 config:** No `DATABASE_URL`, no Docker, no cloud services
- **Persistence:** Data survives restarts, saved to disk
- **Portable:** Clone + npm install + execute = works
- **Structure:** `src/lib/local-data/` with individual stores per entity
- **Compatibility:** `src/lib/prisma.ts` wraps `LocalData` for backward compat

**Closed in:** [#14 — Refactor a almacenamiento local JSON](https://github.com/byAyes/SeaHorse/issues/14)

---

## CI (GitHub Actions)

- **Workflow:** `.github/workflows/main.yml` (consolidated — single workflow)
- **Triggers:** Push to `main`, weekly cron (Tue/Thu 9 AM UTC), manual dispatch
- **Email:** SMTP via Gmail App Password secrets
- **Python deps:** Installed at runtime via `pip install -r scrapers/requirements.txt`
- **Browser:** Chrome/Chromium installed for Scrapling StealthyFetcher
- **Jina Reader:** Optional fallback via `JINA_READER_BASE_URL` secret
- **Timeout:** 30 minutes

### Required CI Secrets

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `GMAIL_RECIPIENT`, `EMAIL_CC`, `JSEARCH_API_KEY`

### Optional CI Secrets

`JINA_READER_BASE_URL` — Self-hosted Jina Reader instance URL (e.g., `http://localhost:3001`)

---

## Test Suite

```bash
# Run all tests
npm test
# Expected: 6 suites, 109 tests passing

# Jina Reader unit tests (19 tests)
npx jest tests/jinaReader.test.ts --verbose

# Jina Reader integration tests (40 tests — ScraperRunner fallback flow)
npx jest tests/jinaReader.integration.test.ts --verbose
```

---

## Open Issues

| #   | Title | Link |
| --- | ----- | ---- |

---

## Closed Issues

| #   | Title                        | Resolution                          |
| --- | ---------------------------- | ----------------------------------- |
| 14  | Refactor: local JSON storage | ✅ Implementado                     |
| 9   | Integración Supabase         | 🔁 Reemplazado por #14 (local JSON) |
| 8   | Frontend UI Dashboard        | ✅ Completado                       |
| 7   | AI PDF profile extraction    | ✅ Implementado and working         |
| 6   | process-cv pipeline          | ✅ Absorbed into #7 + #9            |
| 20  | Jina Reader fallback         | ✅ Implementado + tests integración |

---

## Recent Fixes

- **Jina Reader CLI**: Replaced `import.meta.url` with Jest-safe env-based check (same pattern as jinaReader.ts)
- **`identifyFailedSources()`**: Added `sourceStats.length === 0` guard to prevent `[].every()` returning `true` vacuously
- **`tryJSearch()`**: Stats now recorded on graceful failures (was only recording on thrown errors or success)
- **Docker compose**: Added `CHROMIUM_FLAGS=--no-sandbox`, `cap_add: SYS_ADMIN`, `security_opt` for Chrome in Docker
- **Self-hosted parsers**: Added `parseSelfHostedLinkedIn()` and `extractCompanyFromNextLine()` for Docker format
- **SMTP HTML**: Provider now accepts `html` and `cc` params — emails render with rich formatting (was plain text only)
- **Real match scores**: Orchestrator builds `UserProfile` from extracted CV, calls `calculateMatchScore()` — no more fake `score: 100`
- **CI email switch**: Changed from Resend to SMTP (Gmail App Password) — more reliable
- **Workflow path fix**: Added `.github/workflows/**` to trigger paths — workflow changes now trigger runs
- **Local storage refactor**: Replaced Prisma + Supabase with local JSON files

---

## Docker

### Jina Reader Self-Hosting

```bash
# Start
docker compose up -d jina-reader

# Check status
docker ps --filter name=jina-reader

# View logs
docker compose logs --tail=50 jina-reader

# Test health
curl http://localhost:3001/health

# Pipeline with self-hosted Jina Reader
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "software engineer" 5

# Stop
docker compose down
```

### Port Mapping

| Port   | Protocol     | Usage                          |
| ------ | ------------ | ------------------------------ |
| `3000` | h2c (HTTP/2) | `curl --http2-prior-knowledge` |
| `3001` | HTTP/1.1     | Regular `curl`/`axios`         |

Use **port 3001** for all Seahorse integrations — it's the HTTP/1.1 fallback and works with `axios.get()`.
