# Seahorse — Job Email Automation

> **Automated job board scraping with AI-powered matching + Jina Reader Chrome fallback, delivered to your inbox weekly in beautiful HTML.**

[![Status](https://img.shields.io/badge/status-production-success)](https://github.com/byAyes/SeaHorse)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/byAyes/SeaHorse/main.yml?branch=main)](https://github.com/byAyes/SeaHorse/actions)
[![Tests](https://img.shields.io/badge/tests-109%20passing-brightgreen)](https://github.com/byAyes/SeaHorse)

---

## What It Does

Seahorse automates your job search: scrape **5+ sources** (plus **Jina Reader Chrome fallback**), match jobs against your **AI-extracted profile** with **weighted scoring**, and send a **HTML email digest with emojis and real scores** every week.

```
Upload CV/PDF → Extract profile (AI) → Scrape → Jina Reader fallback → Match → Email
```

### Pipeline Overview

| Step | What                            | Details                                                                                     |
| :--: | ------------------------------- | ------------------------------------------------------------------------------------------- |
|  1   | **Extract profile** from CV/PDF | Gemini AI extracts skills, titles, locations, level, languages                              |
|  2   | **Scrape** job boards           | JSearch API + Python Scrapling (Computrabajo, Indeed, Glassdoor, LinkedIn)                  |
|  3   | **Jina Reader fallback**        | Headless Chrome via Jina Reader rescues jobs from blocked/failed sources (LinkedIn, Indeed) |
|  4   | **Match** against profile       | Skills (40%), Interests (30%), Location (20%), Salary (10%)                                 |
|  5   | **Email** curated digest        | Premium HTML with emojis, scores, stats, CC support                                         |
|  6   | **Cleanup** old jobs            | 3-month retention policy                                                                    |

> **PDF Extraction:** Seahorse uses **pdfmux** (auto-detected Python library) for enhanced PDF text extraction with OCR fallback and confidence scoring. Falls back to pdf-parse automatically if pdfmux is not installed. No Docker required — just `pip install -r scrapers/requirements.txt`.

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **Python 3.12+**
- **Gmail account** with App Password (for SMTP) — or Resend/Gmail API key
- **No database needed** — local JSON storage, zero config
- **Enhanced PDF extraction** — pdfmux auto-detected (Python), no config needed
- **Docker** (optional) — for self-hosted Jina Reader fallback with full LinkedIn/Indeed support

### Setup Scripts

The setup scripts install dependencies, clone the repo, and create `.env`. API keys and profile are configured afterward from the **web wizard** at `http://localhost:3000/setup`.

#### Windows / PowerShell

```powershell
irm https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.ps1 | iex
# Or download and run:
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.ps1" -OutFile "setup.ps1"
.\setup.ps1
```

#### Linux / macOS

```bash
bash <(curl -s https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.sh)
# Or download and run:
curl -O https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.sh
chmod +x setup.sh
./setup.sh
```

#### Manual

```bash
git clone https://github.com/byAyes/SeaHorse.git
cd SeaHorse

npm install
pip install -r scrapers/requirements.txt
playwright install chromium
patchright install chromium
cp .env.example .env
```

### Configuration

**Email (SMTP recommended):**

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your-app-password-here
SMTP_FROM=your.email@gmail.com
GMAIL_RECIPIENT=you@email.com
```

| Provider         | Setup                           | Free Tier |
| ---------------- | ------------------------------- | :-------: |
| **SMTP (Gmail)** | App Password from Google        |  500/day  |
| **Resend**       | `RESEND_API_KEY`                |  100/day  |
| **Gmail API**    | OAuth2 via Google Cloud Console |  500/day  |
| **SendGrid**     | `SENDGRID_API_KEY`              |  100/day  |

**API Keys:**

```env
JSEARCH_API_KEY=your-key-here        # RapidAPI/JSearch
GEMINI_API_KEY=your-key-here         # Google Gemini (profile extraction)
```

**Jina Reader (optional):**

```env
JINA_READER_BASE_URL=http://localhost:3001
```

### First Run

#### Dashboard (default — recommended)

```bash
# Bash
./scripts/run.sh

# PowerShell
.\scripts\run.ps1
```

Open `http://localhost:3000/setup` for the **setup wizard** where you can:
1. Configure API keys (Gemini, JSearch, etc.) from the UI
2. Edit your professional profile (skills, experience, location)
3. Configure email (SMTP, Resend, etc.)

Then visit these sections:
- **Profile** (`/profile`) — Full professional profile view
- **Pipeline** (`/pipeline`) — Run scraping + matching manually
- **Upload** (`/upload`) — Upload CV/PDF for automatic profile extraction

#### Pipeline only (no dashboard)

```bash
./scripts/run.sh --cv path/to/cv.pdf   # Full pipeline
./scripts/run.sh --basic                # Scrape → match → email (no CV)
./scripts/run.sh --jina-reader          # Test Jina Reader standalone

# Or manually:
npx tsx scripts/run-profile-pipeline.ts path/to/your-cv.pdf
```

In ~60-90 seconds you'll get an HTML email with jobs matched to your profile.

---

## Features

### PDF Extraction

| Feature                     | Method                         | File                                |
| --------------------------- | ------------------------------ | ----------------------------------- |
| **pdfmux** enhanced extract | Python library (auto-detect)   | `scripts/pdfmux_extract.py`         |
| pdf-parse fallback          | Node.js library                | `src/lib/pdf/pdfParser.ts`          |
| pdfmux HTTP server (Docker) | FastAPI server (optional)      | `scripts/pdfmux_server.py`          |

pdfmux is **auto-detected** — no env vars needed. If installed, it's used automatically via Python subprocess with OCR fallback and confidence scoring.

### AI PDF Profile Extraction

| Feature                     | Method                         | File                                |
| --------------------------- | ------------------------------ | ----------------------------------- |
| Extract profile from CV/PDF | Gemini AI (`gemini-2.0-flash`) | `src/lib/ai/pdfProfileExtractor.ts` |
| Keyword fallback            | Regex + keyword matching       | `src/lib/ai/pdfProfileExtractor.ts` |
| Build scrape strategy       | Queries from extracted profile | `src/lib/ai/scrapeStrategy.ts`      |
| Pipeline integration        | Full end-to-end                | `scripts/run-profile-pipeline.ts`   |

### Scrapers (5+ sources)

| Source                 | Method              | Status              | Jobs/Run |
| ---------------------- | ------------------- | ------------------- | :------: |
| **JSearch** (RapidAPI) | REST API            | ✅ Always works     |   ~10    |
| **Computrabajo**       | Python Scrapling    | ✅ Reliable         |   ~10    |
| **Indeed**             | Python Scrapling    | ⚠️ Intermittent     |   0-10   |
| **Glassdoor**          | Python Scrapling    | ⚠️ Intermittent     |   0-10   |
| **LinkedIn**           | Python Scrapling    | ❌ Blocked          |    0     || **pdfmux**         | Python (auto subprocess)       | ✅ Auto-detected    |    —     |
| **Jina Reader**     | Headless Chrome API            | ✅ Fallback rescuer |  +1-10   |

> **pdfmux** enhances CV/PDF extraction with auto-healing, OCR fallback, and confidence scoring. Installed automatically with `pip install -r scrapers/requirements.txt`. No config needed.

> **Jina Reader** acts as an automatic fallback. When `JINA_READER_BASE_URL` is set, `ScraperRunner` detects failed sources (e.g., LinkedIn blocked, Indeed intermittent) and fires Jina Reader's headless Chrome to scrape them. With **self-hosting via Docker**, LinkedIn yields **10 jobs**, Glassdoor and Computrabajo work fully.

**Total per run:** ~15-31 jobs (failed scrapers don't crash pipeline — Jina Reader rescues them).

### Matching Engine

| Factor    | Weight  | How it works                                   |
| --------- | :-----: | ---------------------------------------------- |
| Skills    | **40%** | Fuzzy matching (Levenshtein) against CV skills |
| Interests | **30%** | Job title/industry vs career interests         |
| Location  | **20%** | Exact city, remote hybrid, partial matches     |
| Salary    | **10%** | Range overlap, penalizes over-max budgets      |

Color-coded badges: Excellent (>=80%), Good (>=60%), Potential (<60%)

### Email Providers

| Provider         | Method       | HTML |   CC    |   Status    |
| ---------------- | ------------ | :--: | :-----: | :---------: |
| **SMTP (Gmail)** | App Password | Yes  |   Yes   | **Default** |
| **Resend**       | API          | Yes  | Partial |  Available  |
| **Gmail API**    | OAuth2       | Yes  |   Yes   |  Available  |
| **SendGrid**     | API          | Yes  |   Yes   |  Available  |

### Jina Reader Fallback

**Jina Reader** (`src/scrapers/strategies/jinaReader.ts`) is a headless Chrome-based fallback scraper that automatically rescues job listings when primary scrapers fail. It integrates into `ScraperRunner` with:

- **`identifyFailedSources()`** — analyzes which scrapers returned 0 jobs after a run
- **`runJinaReaderFallbacks()`** — fires Jina Reader for each failed source, deduplicates results
- **Self-hosted Docker support** — bypasses cloud rate limits and LinkedIn TOS blocks
- **4 source parsers**: LinkedIn, Indeed, Computrabajo, Glassdoor

**Self-hosting (Docker):**

```bash
# Start the container
docker compose up -d jina-reader

# Test it
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 10

# Run the pipeline with fallback
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "desarrollador" 5
```

### Dashboard UI

- **Dashboard** (`/dashboard`) — Stats grid, job trend chart, recent matches, pipeline health card
- **Profile** (`/profile`) — Full professional profile view with skills, experience, languages, matching weights
- **Jobs** (`/jobs`) — Job table with search, score filter, sort, score breakdown modal
- **Pipeline** (`/pipeline`) — Manual trigger with real-time progress, pipeline history stats
- **Upload** (`/upload`) — Drag-and-drop CV upload with AI processing preview (3-step wizard)
- **Settings** (`/settings`) — Profile editor, email config, API keys (with auto-refresh status), theme, language
- **Setup Wizard** (`/setup`) — 5-step onboarding: welcome, API keys, profile, email, finish
- Dark/light mode + multilingual (EN/ES/PT/FR/DE)

### REST API

Full API reference at [`docs/API.md`](docs/API.md). Quick overview:

| Endpoint               | Method | Description                                         |
| ---------------------- | :----: | --------------------------------------------------- |
| `/api/health`          |  GET   | System healthcheck — uptime, env vars, connectivity |
| `/api/pipeline/run`    |  GET   | Poll pipeline status                                |
| `/api/pipeline/run`    |  POST  | Start new pipeline execution                        |
| `/api/stats`           |  GET   | Dashboard statistics                                |
| `/api/match-jobs`      |  GET   | Jobs scored against profile                         |
| `/api/cv/upload`       |  POST  | Upload CV PDF                                       |
| `/api/cv/process`      |  POST  | Extract skills, experience, education from CV       |
| `/api/profile/extract` |  GET   | Get user profile                                    |
| `/api/profile/extract` |  POST  | Extract profile from PDF/text                       |
| `/api/email/send`      |  GET   | Send test email                                     |
| `/api/email/send`      |  POST  | Send email via configured provider                  |
| `/api/pdf/upload`      |  POST  | Upload job listing PDF                              |
| `/api/config/keys`     |  GET   | List configured API keys                            |
| `/api/config/keys`     |  POST  | Save API keys                                       |

> **Healthcheck** (`GET /api/health`) reports system status: uptime, Node.js version, environment variable configuration (what's set/missing), Jina Reader connectivity, Python scraper config parsing, and ScraperRunner module import status. Returns `200` when healthy, `503` when degraded. No auth required, no rate limiting.

### Automation

- **Weekly cron** via GitHub Actions (Thu 9 AM UTC)
- **Push trigger** on `main`
- **Manual trigger** via Actions tab or CLI
- **SMTP secrets** configured for CI
- **Jina Reader optional** — `JINA_READER_BASE_URL` from secrets
- **Structured logging** with per-scraper stats

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ GitHub Actions (main.yml)                           │
│ Push to main + Weekly cron (Thu 9 AM UTC)          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Pipeline Entry                                      │
│ scripts/run-profile-pipeline.ts OR scheduler.ts     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ Orchestrator (src/automation/orchestrator.ts)            │
│                                                          │
│  0. Extract Profile (if CV/PDF provided)                 │
│     • Gemini AI extraction from PDF text                 │
│     • Fallback: keyword extraction                       │
│     • Build scrape strategy (queries, locations)         │
│                                                          │
│  1. Scrape (parallel + Jina Reader fallback)             │
│     ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐     │
│     │ JSearch  │ │Computrab.│ │ Indeed │ │Glassd.│     │
│     │ (REST)   │ │(Scrap.)  │ │(Scrap.)│ │(Scrp.)│     │
│     └──────────┘ └──────────┘ └────────┘ └───────┘     │
│           │              │          │         │          │
│           ▼              ▼          ▼         ▼          │
│     ┌─────────────────────────────────────────────┐     │
│     │  identifyFailedSources() → JinaReader       │     │
│     │  Headless Chrome fallback for blocked sites │     │
│     │  LinkedIn: ✅ rescued | Indeed: ✅ rescued  │     │
│     └─────────────────────────────────────────────┘     │
│                                                          │
│  2. Score (calculateMatchScore)                          │
│     Skills 40% · Interests 30% · Location 20%           │
│     Salary 10% · Real scores                            │
│                                                          │
│  3. Send Email Digest (SMTP)                             │
│     Premium HTML template + match scores + stats         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Python Scrapers (subprocess)                        │
│ Scrapling StealthyFetcher · JSON stdout → TS bridge │
│ 3x retry with exp. backoff                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Local JSON Storage (data/) + Jina Reader (Docker)       │
│ Zero config · No DB required · Auto-created             │
│ Docker: docker compose up -d jina-reader (optional)     │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
seahorse/
├── pdfmux.Dockerfile              # Docker image for pdfmux HTTP server (optional)
├── docker-compose.yml             # Jina Reader + pdfmux services (optional)
├── scripts/
│   ├── pdfmux_server.py           # FastAPI server for pdfmux (optional, Docker)
│   ├── pdfmux_extract.py          # Standalone pdfmux extraction (auto subprocess)
├── .github/workflows/
│   └── main.yml                  # Primary pipeline (incl. optional JINA_READER_BASE_URL)
├── .planning/                    # Roadmap, specs, refactoring plans
├── scrapers/                     # Python Scrapling scrapers
│   ├── shared/                   # Base scraper, models, config, runner
│   ├── computrabajo.py
│   ├── glassdoor.py
│   ├── indeed.py
│   ├── linkedin.py
│   └── requirements.txt
├── docs/
│   └── API.md                    # ★ Full REST API reference
├── src/
│   ├── lib/
│   │   ├── pdf/
│   │   │   ├── pdfParser.ts       # PDF parser entry point (auto-selects pdfmux)
│   │   │   ├── pdfmuxParser.ts    # pdfmux client (HTTP + subprocess + fallback)
├── src/
│   ├── app/
│   │   ├── (main)/               # Dashboard pages
│   │   │   ├── dashboard/        # Stats, charts, recent matches
│   │   │   ├── profile/          # Full professional profile view
│   │   │   ├── jobs/             # Job table with scores
│   │   │   ├── pipeline/         # Run pipeline manually
│   │   │   ├── settings/         # Profile, email, API keys, i18n
│   │   │   ├── setup/            # 5-step onboarding wizard
│   │   │   ├── upload/           # CV drag & drop
│   │   │   └── layout.tsx        # Sidebar + header layout
│   │   └── api/                  # REST API routes (docs/API.md)
│   │       ├── health/           # GET /api/health — system status
│   ├── automation/
│   │   ├── orchestrator.ts       # Pipeline logic
│   │   ├── scheduler.ts          # Entry point
│   │   └── matcher/              # AI matchers (keyword, gemini, ollama, openai)
│   ├── components/               # UI components
│   ├── lib/
│   │   ├── ai/                   # pdfProfileExtractor, scrapeStrategy
│   │   ├── email/                # sendEmail(), template, providers
│   │   ├── i18n/                 # EN, ES, PT, FR, DE locales
│   │   ├── pdf/                  # Parsing, duplicate detection
│   │   ├── cv/                   # CV parsing, profile history
│   │   ├── local-data/           # Local JSON storage (stores/*.ts)
│   │   └── prisma.ts             # Data layer wrapper (compat)
│   ├── matching/                 # scorer, skill/interest/location/salary matchers
│   ├── scrapers/
│   │   ├── index.ts              # ScraperRunner + JinaReader fallback orchestration
│   │   ├── bridge/
│   │   │   └── pythonBridge.ts   # Python subprocess bridge
│   │   ├── strategies/
│   │   │   ├── jsearch.ts        # JSearch REST API scraper
│   │   │   ├── indeed.ts         # Indeed HTTP scraper
│   │   │   ├── jinaReader.ts     # ★ Jina Reader headless Chrome fallback
│   │   │   └── httpScraper.ts    # Generic HTTP scraper
│   │   ├── types.ts
│   │   └── utils/
│   │       └── rateLimiter.ts
│   └── types/                    # TypeScript interfaces
├── tests/
│   ├── jinaReader.test.ts        # 19 unit tests (Jina Reader)
│   ├── jinaReader.integration.test.ts  # 40 integration tests (ScraperRunner fallback)
│   ├── rate-limiter.test.ts
│   ├── auth-middleware.test.ts
│   ├── config-store.test.ts
│   └── pdfProfileExtractor.test.ts
├── docker-compose.yml            # Jina Reader self-hosting (optional)
├── scrapers.yaml                 # Scraper definitions
└── data/                         # Local JSON storage (gitignored, auto-created)
```

---

## Available Commands

```bash
# ─── Dev Server ────────────────────────────────────
# Clean start (kills zombie servers first, then starts)
npm run dev:clean
# Or:
./scripts/dev.sh           # Bash (Linux/macOS)
.\scripts\dev.ps1          # PowerShell (Windows)

# Quick start (assumes no stale server)
npm run dev

# ─── Runner Scripts ────────────────────────────────
# Dashboard (default)
./scripts/run.sh

# Full pipeline with CV
./scripts/run.sh --cv path/to/cv.pdf

# Pipeline basic (scrape → match → email)
./scripts/run.sh --basic

# Test Jina Reader
./scripts/run.sh --jina-reader

# ─── Pipeline (direct) ─────────────────────────────
# Full pipeline with CV/PDF extraction
npx tsx scripts/run-profile-pipeline.ts path/to/cv.pdf

# Basic pipeline (scrape → match → email)
npm run automate

# ─── Jina Reader (Headless Chrome Fallback) ────────
# Test Jina Reader against a specific source
npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 10
npx tsx src/scrapers/strategies/jinaReader.ts indeed "software developer" 5
npx tsx src/scrapers/strategies/jinaReader.ts computrabajo "desarrollador full stack" 10
npx tsx src/scrapers/strategies/jinaReader.ts glassdoor "data scientist" 5

# Test the pipeline fallback flow (ScraperRunner + JinaReader)
npx tsx src/scrapers/index.ts "software engineer" 10

# With self-hosted Jina Reader (via Docker)
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "desarrollador" 5

# ─── Docker (Self-hosted Jina Reader) ──────────────
# Start Jina Reader
docker compose up -d jina-reader

# View logs
docker compose logs --tail=50 jina-reader

# Stop
docker compose down

# ─── Email ─────────────────────────────────────────
# Test email sending
npx tsx scripts/test-email.ts

# ─── Matching ──────────────────────────────────────
# Test matching engine
npx tsx scripts/test-matching.ts

# ─── Python Scrapers (Direct) ──────────────────────
python -m scrapers.computrabajo --query "software engineer" --max 5
python -m scrapers.indeed --query "software engineer" --max 5
```

---

## Testing

```bash
# Run all test suites (6 suites, 109 tests)
npm test

# Run tests in watch mode
npm run test:watch

# Jina Reader unit tests (19 tests — parser edge cases, salary/rating/location extraction)
npx jest tests/jinaReader.test.ts --verbose

# Jina Reader integration tests (40 tests — ScraperRunner fallback flow, 4 sources, error states)
npx jest tests/jinaReader.integration.test.ts --verbose

# Specific test files
npx jest tests/rate-limiter.test.ts
npx jest tests/auth-middleware.test.ts
npx jest tests/config-store.test.ts
npx jest tests/pdfProfileExtractor.test.ts
```

### Test Suites (109 tests, 6 suites)

| Suite                      | Tests | What it covers                                                                                                                           |
| -------------------------- | :---: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `jinaReader` (unit)        |  19   | Parser extraction: titles, companies, locations, salaries, ratings, edge cases (403/451/429/DNS), Spanish patterns, dedup, maxJobs       |
| `jinaReader` (integration) |  40   | ScraperRunner fallback flow: `identifyFailedSources()`, `runJinaReaderFallbacks()`, 4 source parsers, error states, stats, dedup         |
| `rate-limiter`             |  12   | `getClientIp` (4 headers) + `checkRateLimit` (allow, block, remaining, custom window, IP isolation)                                      |
| `auth-middleware`          |   9   | `authenticate` — no token, valid token, whitespace, missing/empty/wrong header/wrong scheme, empty Bearer, wrong token                   |
| `config-store`             |  15   | `loadConfig` (existing/missing/parse error), `saveConfig` (merge/new file/strip undefined/ensureDir), `getApiKey`, `getActiveAiProvider` |
| `pdfProfileExtractor`      |  14   | Gemini AI profile extraction: strategy builder, search queries, source prioritization, profile integrity                                 |

**Setup:** Jest + ts-jest with a separate `tsconfig.test.json` (CommonJS) — the project's `tsconfig.json` is unaffected. All tests run cleanly with no external services or database required.

---

## Environment Variables

### Jina Reader (optional)

| Variable               | Description                      | Default                     |
| ---------------------- | -------------------------------- | --------------------------- |
| `JINA_READER_BASE_URL` | Self-hosted Jina Reader instance | `https://r.jina.ai` (cloud) |

### Email (SMTP — recommended)

| Variable          | Description               | Required |
| ----------------- | ------------------------- | :------: |
| `EMAIL_PROVIDER`  | `smtp` (recommended)      |   Yes    |
| `SMTP_HOST`       | `smtp.gmail.com`          | For SMTP |
| `SMTP_PORT`       | `587`                     | For SMTP |
| `SMTP_USER`       | Your Gmail address        | For SMTP |
| `SMTP_PASSWORD`   | Gmail App Password        | For SMTP |
| `SMTP_FROM`       | Sender email              | For SMTP |
| `GMAIL_RECIPIENT` | Email address for digests |   Yes    |
| `EMAIL_CC`        | CC address on digests     | Optional |

### API Keys

| Variable          | Description           |         Required          |
| ----------------- | --------------------- | :-----------------------: |
| Variable            | Description                      | Required                     |
| ------------------- | -------------------------------- | :--------------------------: |
| `PDFMUX_QUALITY`    | fast / standard / premium        | Optional (default: standard) |
| `PDFMUX_URL`        | pdfmux HTTP server endpoint      | Optional (Docker mode only)  |
| `JSEARCH_API_KEY`   | RapidAPI JSearch key             | For JSearch scraper          |
| `GEMINI_API_KEY`    | Google Gemini API key            | For AI profile extraction    |

### Alternative Email Providers

| Variable               | Description               | For       |
| ---------------------- | ------------------------- | --------- |
| `RESEND_API_KEY`       | Resend API key            | Resend    |
| `RESEND_FROM_EMAIL`    | Resend sender             | Resend    |
| `SENDGRID_API_KEY`     | SendGrid API key          | SendGrid  |
| `GOOGLE_CLIENT_ID`     | Gmail OAuth client ID     | Gmail API |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret | Gmail API |
| `GMAIL_REFRESH_TOKEN`  | Gmail refresh token       | Gmail API |

---

## Pipeline Performance

| Source                    | Avg Jobs  |  Reliability  | Method                   |
| ------------------------- | :-------: | :-----------: | ------------------------ |
| JSearch                   |    ~10    |     High      | REST API                 |
| Computrabajo              |    ~10    |     High      | Python Scrapling         |
| Indeed                    |   0-10    |    Medium     | Python Scrapling         |
| Glassdoor                 |   0-10    |    Medium     | Python Scrapling         |
| LinkedIn                  |     0     |      Low      | Anti-bot (blocked)       |
| **JinaReader** (fallback) | **+1-10** | **✅ Active** | Headless Chrome (Docker) |
| **Total**                 | **15-31** |       —       | —                        |

> **Jina Reader self-hosting results (validated 2025-05-19):**
>
> - LinkedIn: 10 jobs (standalone) / 1 job (pipeline fallback)
> - Computrabajo: 6+ jobs with full salary extraction
> - Glassdoor: Jobs with salaries + ratings
> - Indeed: 2 jobs (format differs from cloud version)

---

## GitHub Actions

The workflow runs on **push to `main`** and **weekly (Tue/Thu 9 AM UTC)**:

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 2,4'
  workflow_dispatch:
```

### Required Secrets for CI

| Secret            | Value              |
| ----------------- | ------------------ |
| `SMTP_HOST`       | `smtp.gmail.com`   |
| `SMTP_PORT`       | `587`              |
| `SMTP_USER`       | Your Gmail         |
| `SMTP_PASSWORD`   | Gmail App Password |
| `SMTP_FROM`       | Your Gmail         |
| `GMAIL_RECIPIENT` | Destination email  |
| `JSEARCH_API_KEY` | RapidAPI key       |

### Optional Secrets for CI

| Secret                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `JINA_READER_BASE_URL` | Self-hosted Jina Reader URL (e.g., http://localhost:3001) |

> When `JINA_READER_BASE_URL` is set, the pipeline automatically runs Jina Reader fallback for blocked sources. When unset, it's skipped gracefully.

---

## Tech Stack

| Layer             | Tech                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| **Runtime**       | Node.js 20+ (ESM) + tsx                                                    |
| **Framework**     | Next.js 16 (App Router) + React 19                                         |
| **AI Extraction** | Gemini Flash (`gemini-2.0-flash`)                                          |
| **Scraping**      | Python 3.12 + Scrapling StealthyFetcher + JSearch API + Jina Reader Chrome |
| **Matching**      | TypeScript — weighted scoring (40/30/20/10)                                |
| **Email**         | SMTP (default), Resend, Gmail API, SendGrid                                |
| **Dashboard**     | Tailwind CSS 4 + Framer Motion + Recharts + TanStack Query                 |
| **State**         | Zustand                                                                    |
| **Storage**       | Local JSON (`data/`) — zero config, zero external deps                     |
| **i18n**          | EN, ES, PT, FR, DE                                                         |
| **CI/CD**         | GitHub Actions (push + weekly cron) + optional Docker                      |
| **Fallback**      | Jina Reader headless Chrome (self-hosted via Docker)                       |

---

## Roadmap

| #   | Phase                               | Status                 |
| --- | ----------------------------------- | ---------------------- |
| 1   | Job Board Scraper                   | Complete               |
| 2   | AI Job Matching                     | Complete               |
| 3   | Email Notifications (HTML + scores) | Complete               |
| 4   | Automation & Scheduling             | Complete               |
| 5   | AI PDF Profile Extraction           | Complete               |
| 6   | ~~Supabase Database~~               | Cancelled (IPv6 block) |
| 7   | Frontend UI Dashboard               | Complete               |
| 8   | Local JSON Storage (0 config DB)    | Complete               |
| 9   | **Jina Reader Chrome Fallback**     | **Complete**           |
| 10  | **pdfmux Enhanced PDF Extraction**  | **Complete**           |

---

## pdfmux — Enhanced PDF Extraction

pdfmux is an orchestrated PDF extraction library that auto-detects and extracts text with OCR fallback and confidence scoring.

**No setup needed** — just `pip install -r scrapers/requirements.txt` (already in setup scripts).

### Quality Modes

| Mode      | Use Case                        | Speed |
| --------- | ------------------------------- | ----- |
| `fast`    | Clean digital PDFs              | High  |
| `standard` | Mixed documents/tables         | Moderate |
| `premium` | Scans, handwriting, complex layouts | Lower |

### Configuration

```env
# Optional: default is standard
PDFMUX_QUALITY=standard

# Optional: use HTTP server mode (Docker) instead of subprocess
# PDFMUX_URL=http://localhost:3100
```

### Self-Hosting with Docker (optional)

```bash
docker compose build pdfmux
docker compose up -d pdfmux
```

---

## Self-Hosting Jina Reader

Run your own Jina Reader instance via Docker for full LinkedIn/Indeed support without rate limits:

```bash
# Start the container
docker compose up -d jina-reader

# Verify it's running
curl http://localhost:3001/health

# Test LinkedIn scraping
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 10

# Run the full pipeline with self-hosted fallback
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/index.ts "desarrollador full stack" 5

# View container logs
docker compose logs --tail=50 jina-reader

# Stop the container
docker compose down
```

### Docker Compose Configuration

```yaml
services:
  jina-reader:
    image: ghcr.io/jina-ai/reader:oss
    container_name: seahorse-jina-reader
    ports:
      - '3000:8080' # HTTP/2 with prior knowledge
      - '3001:8081' # HTTP/1.1 fallback (use this)
    environment:
      - CHROMIUM_FLAGS=--no-sandbox # Required for Puppeteer in Docker
      - NODE_ENV=production
```

---

## Contributing

Fork and adapt for your own job search. Ideas:

- New scrapers for other job boards
- Push notifications (Telegram, Slack)
- LinkedIn anti-bot bypass strategy
- Advanced Jina Reader caching (S3 bucket config)

---

## License

ISC License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for efficient job searching**

[GitHub](https://github.com/byAyes/SeaHorse) · [Issues](https://github.com/byAyes/SeaHorse/issues) · [Roadmap](.planning/ROADMAP.md)

</div>
