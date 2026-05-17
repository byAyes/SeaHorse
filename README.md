# Seahorse — Job Email Automation

> **Automated job board scraping with AI-powered matching, delivered to your inbox weekly in beautiful HTML.**

[![Status](https://img.shields.io/badge/status-production-success)](https://github.com/byAyes/SeaHorse)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/byAyes/SeaHorse/main.yml?branch=main)](https://github.com/byAyes/SeaHorse/actions)

---

## What It Does

Seahorse automates your job search: scrape **5+ sources**, match jobs against your **AI-extracted profile** with **weighted scoring**, and send a **HTML email digest with emojis and real scores** every week.

```
Upload CV/PDF → Extract profile (AI) → Scrape → Match → Email
```

### Pipeline Overview

| Step | What | Details |
|:----:|------|---------|
| 1 | **Extract profile** from CV/PDF | Gemini AI extracts skills, titles, locations, level, languages |
| 2 | **Scrape** job boards | JSearch API + Python Scrapling (Computrabajo, Indeed, Glassdoor, LinkedIn) |
| 3 | **Match** against profile | Skills (40%), Interests (30%), Location (20%), Salary (10%) |
| 4 | **Email** curated digest | Premium HTML with emojis, scores, stats, CC support |
| 5 | **Cleanup** old jobs | 3-month retention policy |

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **Python 3.12+**
- **Gmail account** with App Password (for SMTP) — or Resend/Gmail API key
- **No database needed** — local JSON storage, zero config

### Installation

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

| Provider | Setup | Free Tier |
|----------|-------|:---------:|
| **SMTP (Gmail)** | App Password from Google | 500/day |
| **Resend** | `RESEND_API_KEY` | 100/day |
| **Gmail API** | OAuth2 via Google Cloud Console | 500/day |
| **SendGrid** | `SENDGRID_API_KEY` | 100/day |

**API Keys:**

```env
JSEARCH_API_KEY=your-key-here        # RapidAPI/JSearch
GEMINI_API_KEY=your-key-here         # Google Gemini (profile extraction)
```

### First Run

```bash
npx tsx scripts/run-profile-pipeline.ts path/to/your-cv.pdf
```

In ~60-90 seconds you'll get an HTML email with jobs matched to your profile.

---

## Features

### AI PDF Profile Extraction

| Feature | Method | File |
|---------|--------|------|
| Extract profile from CV/PDF | Gemini AI (`gemini-2.0-flash`) | `src/lib/ai/pdfProfileExtractor.ts` |
| Keyword fallback | Regex + keyword matching | `src/lib/ai/pdfProfileExtractor.ts` |
| Build scrape strategy | Queries from extracted profile | `src/lib/ai/scrapeStrategy.ts` |
| Pipeline integration | Full end-to-end | `scripts/run-profile-pipeline.ts` |

### Scrapers (5 sources)

| Source | Method | Status | Jobs/Run |
|--------|--------|:------:|:--------:|
| **JSearch** (RapidAPI) | REST API | Always works | ~10 |
| **Computrabajo** | Python Scrapling | Stealth browser | ~10 |
| **Indeed** | Python Scrapling | Intermittent | 0-10 |
| **Glassdoor** | Python Scrapling | Intermittent | 0-10 |
| **LinkedIn** | Python Scrapling | Blocked | 0 |

**Total per run:** ~15-20 jobs (failed scrapers don't crash pipeline)

### Matching Engine

| Factor | Weight | How it works |
|--------|:------:|--------------|
| Skills | **40%** | Fuzzy matching (Levenshtein) against CV skills |
| Interests | **30%** | Job title/industry vs career interests |
| Location | **20%** | Exact city, remote hybrid, partial matches |
| Salary | **10%** | Range overlap, penalizes over-max budgets |

Color-coded badges: Excellent (>=80%), Good (>=60%), Potential (<60%)

### Email Providers

| Provider | Method | HTML | CC | Status |
|----------|--------|:----:|:--:|:------:|
| **SMTP (Gmail)** | App Password | Yes | Yes | **Default** |
| **Resend** | API | Yes | Partial | Available |
| **Gmail API** | OAuth2 | Yes | Yes | Available |
| **SendGrid** | API | Yes | Yes | Available |

### Dashboard UI

- Stats: total jobs, today's jobs, matches, trend, top skills
- Jobs table: search, filter by score, sort, score breakdown modal
- Pipeline page: manual trigger, real-time progress
- Settings: profile, email config, API keys, theme, language
- Upload page: drag-and-drop CV with AI processing preview
- Dark/light mode + multilingual (EN/ES/PT/FR/DE)

### Automation

- **Weekly cron** via GitHub Actions (Thu 9 AM UTC)
- **Push trigger** on `main`
- **Manual trigger** via Actions tab or CLI
- **SMTP secrets** configured for CI
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
┌─────────────────────────────────────────────────────┐
│ Orchestrator (src/automation/orchestrator.ts)       │
│                                                     │
│  0. Extract Profile (if CV/PDF provided)            │
│     • Gemini AI extraction from PDF text            │
│     • Fallback: keyword extraction                  │
│     • Build scrape strategy (queries, locations)    │
│                                                     │
│  1. Scrape (parallel)                               │
│     ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ │
│     │ JSearch  │ │Computrab.│ │ Indeed │ │Glassd.│ │
│     │ (REST)   │ │(Scrap.)  │ │(Scrap.)│ │(Scrp.)│ │
│     └──────────┘ └──────────┘ └────────┘ └───────┘ │
│                                                     │
│  2. Score (calculateMatchScore)                     │
│     Skills 40% · Interests 30% · Location 20%      │
│     Salary 10% · Real scores                       │
│                                                     │
│  3. Send Email Digest (SMTP)                        │
│     Premium HTML template + match scores + stats    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Python Scrapers (subprocess)                        │
│ Scrapling StealthyFetcher · JSON stdout → TS bridge │
│ 3x retry with exp. backoff                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Local JSON Storage (data/)                          │
│ Zero config · No DB required · Auto-created         │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
seahorse/
├── .github/workflows/
│   └── main.yml                  # Primary pipeline
├── .planning/                    # Roadmap, specs, refactoring plans
├── scrapers/                     # Python Scrapling scrapers
│   ├── shared/                   # Base scraper, models, config, runner
│   ├── computrabajo.py
│   ├── glassdoor.py
│   ├── indeed.py
│   ├── linkedin.py
│   └── requirements.txt
├── src/
│   ├── app/
│   │   ├── (main)/               # Dashboard pages
│   │   │   ├── dashboard/        # Stats, charts, recent matches
│   │   │   ├── jobs/             # Job table with scores
│   │   │   ├── pipeline/         # Run pipeline manually
│   │   │   ├── settings/         # Profile, email, API keys, i18n
│   │   │   ├── upload/           # CV drag & drop
│   │   │   └── layout.tsx        # Sidebar + header layout
│   │   └── api/                  # REST API routes
│   │       ├── cv/               # Upload, process, update-profile
│   │       ├── email/            # Send digest
│   │       ├── match-jobs/       # Score jobs against profile
│   │       ├── pdf/              # Upload, match
│   │       ├── pipeline/         # Run + poll status
│   │       ├── profile/          # Extract, history
│   │       └── stats/            # Dashboard aggregation
│   ├── automation/
│   │   ├── orchestrator.ts       # Pipeline logic
│   │   ├── scheduler.ts          # Entry point
│   │   └── matcher/              # AI matchers (keyword, gemini, ollama, openai)
│   ├── components/               # UI components (dashboard, layout, upload, ui)
│   ├── lib/
│   │   ├── ai/                   # pdfProfileExtractor, scrapeStrategy
│   │   ├── email/                # sendEmail(), template, providers (smtp/resend/sendgrid/gmail)
│   │   ├── i18n/                 # EN, ES, PT, FR, DE locales
│   │   ├── pdf/                  # Parsing, duplicate detection
│   │   ├── cv/                   # CV parsing, profile history
│   │   └── prisma.ts             # Data layer (currently mock, migrating to local JSON)
│   ├── matching/                 # scorer, skill/interest/location/salary matchers
│   ├── scrapers/                 # ScraperRunner, Python bridge, JSearch, rate limiter
│   └── types/                    # TypeScript interfaces
├── scripts/                      # CLI scripts (pipeline, email, matching, cleanup)
├── scrapers.yaml                 # Scraper definitions
└── data/                         # Local JSON storage (gitignored, auto-created)
```

---

## Available Commands

```bash
# Full pipeline with CV/PDF extraction
npx tsx scripts/run-profile-pipeline.ts path/to/cv.pdf

# Basic pipeline
npm run automate

# Dev server (Next.js dashboard)
npm run dev

# Test email
npx tsx scripts/test-email.ts

# Test matching engine
npx tsx scripts/test-matching.ts

# Run specific scrapers (Python)
python -m scrapers.computrabajo --query "software engineer" --max 5
python -m scrapers.indeed --query "software engineer" --max 5
```

---

## Environment Variables

### Email (SMTP — recommended)

| Variable | Description | Required |
|----------|-------------|:--------:|
| `EMAIL_PROVIDER` | `smtp` (recommended) | Yes |
| `SMTP_HOST` | `smtp.gmail.com` | For SMTP |
| `SMTP_PORT` | `587` | For SMTP |
| `SMTP_USER` | Your Gmail address | For SMTP |
| `SMTP_PASSWORD` | Gmail App Password | For SMTP |
| `SMTP_FROM` | Sender email | For SMTP |
| `GMAIL_RECIPIENT` | Email address for digests | Yes |
| `EMAIL_CC` | CC address on digests | Optional |

### API Keys

| Variable | Description | Required |
|----------|-------------|:--------:|
| `JSEARCH_API_KEY` | RapidAPI JSearch key | For JSearch scraper |
| `GEMINI_API_KEY` | Google Gemini API key | For AI profile extraction |

### Alternative Email Providers

| Variable | Description | For |
|----------|-------------|-----|
| `RESEND_API_KEY` | Resend API key | Resend |
| `RESEND_FROM_EMAIL` | Resend sender | Resend |
| `SENDGRID_API_KEY` | SendGrid API key | SendGrid |
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID | Gmail API |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret | Gmail API |
| `GMAIL_REFRESH_TOKEN` | Gmail refresh token | Gmail API |

---

## Pipeline Performance

| Source | Avg Jobs | Reliability | Method |
|--------|:--------:|:-----------:|--------|
| JSearch | ~10 | High | REST API |
| Computrabajo | ~10 | High | Python Scrapling |
| Indeed | 0-10 | Medium | Python Scrapling |
| Glassdoor | 0-10 | Medium | Python Scrapling |
| LinkedIn | 0 | Low | Anti-bot (blocked) |

**Total:** ~15-20 jobs per run, delivered in ~60-90s.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js 20+ (ESM) + tsx |
| **Framework** | Next.js 16 (App Router) + React 19 |
| **AI Extraction** | Gemini Flash (`gemini-2.0-flash`) |
| **Scraping** | Python 3.12 + Scrapling StealthyFetcher |
| **Matching** | TypeScript — weighted scoring (40/30/20/10) |
| **Email** | SMTP (default), Resend, Gmail API, SendGrid |
| **Dashboard** | Tailwind CSS 4 + Framer Motion + Recharts + TanStack Query |
| **State** | Zustand |
| **Storage** | Local JSON (`data/`) — zero config, zero external deps |
| **i18n** | EN, ES, PT, FR, DE |
| **CI/CD** | GitHub Actions (push + weekly cron) |

---

## GitHub Actions

The workflow runs on **push to `main`** and **weekly (Thu 9 AM UTC)**:

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 2,4'
  workflow_dispatch:
```

**Required secrets for CI:**

| Secret | Value |
|--------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail |
| `SMTP_PASSWORD` | Gmail App Password |
| `SMTP_FROM` | Your Gmail |
| `GMAIL_RECIPIENT` | Destination email |
| `JSEARCH_API_KEY` | RapidAPI key |

---

## Roadmap

| # | Phase | Status |
|---|-------|--------|
| 1 | Job Board Scraper | Complete |
| 2 | AI Job Matching | Complete |
| 3 | Email Notifications (HTML + scores) | Complete |
| 4 | Automation & Scheduling | Complete |
| 5 | AI PDF Profile Extraction | Complete |
| 6 | ~~Supabase Database~~ | Cancelled (IPv6 block) |
| 7 | Frontend UI Dashboard | Complete |
| 8 | Remove DB dead code + local JSON storage | Planned |

---

## Contributing

Fork and adapt for your own job search. Ideas:

- New scrapers for other job boards
- LinkedIn anti-bot bypass strategy
- Push notifications (Telegram, Slack)
- Docker support

---

## License

ISC License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for efficient job searching**

[GitHub](https://github.com/byAyes/SeaHorse) · [Issues](https://github.com/byAyes/SeaHorse/issues) · [Roadmap](.planning/ROADMAP.md)

</div>
