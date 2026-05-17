# 🐴 Seahorse — Job Email Automation

> **Automated job board scraping with AI-powered matching, delivered to your inbox weekly in beautiful HTML.**

[![Status](https://img.shields.io/badge/status-production-success)](https://github.com/byAyes/SeaHorse)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/byAyes/SeaHorse/main.yml?branch=main)](https://github.com/byAyes/SeaHorse/actions)

---

## 🎯 What It Does

Seahorse automates your job search by scraping **5+ sources**, matching jobs against your **AI-extracted profile** with **weighted scoring**, and sending you a **beautiful HTML email digest with emojis and real scores** every week.

```
Upload CV/PDF → Extract profile (AI) → Scrape → Match → Email
```

### Pipeline Overview

| Step | What | Details |
|:----:|------|---------|
| ① | **Extract profile** from CV/PDF | Gemini AI extracts skills, titles, locations, level, languages |
| ② | **Scrape** job boards | JSearch API + Python Scrapling (Computrabajo, Indeed, Glassdoor, LinkedIn) |
| ③ | **Match** against profile | Skills (40%), Interests (30%), Location (20%), Salary (10%) |
| ④ | **Email** curated digest | Premium HTML with emojis, scores, stats, CC support |
| ⑤ | **Cleanup** old jobs | 3-month retention policy |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **Python 3.12+**
- **Gmail account** with App Password (for SMTP) — or Resend/Gmail API key
- **No database needed** (almacenamiento local en JSON)

### Installation

```bash
# Clone
git clone https://github.com/byAyes/SeaHorse.git
cd SeaHorse

# Node dependencies
npm install

# Python dependencies (for Scrapling scrapers)
pip install -r scrapers/requirements.txt

# Install Playwright browsers (required by Scrapling StealthyFetcher)
playwright install chromium
patchright install chromium

# ¡Listo! No necesitas base de datos — los datos se guardan localmente en data/
cp .env.example .env
```

### Configuration

**1. Email Provider (SMTP recommended):**

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your-app-password-here
SMTP_FROM=your.email@gmail.com
GMAIL_RECIPIENT=you@email.com

# Optional: CC someone else on every digest
# EMAIL_CC=juanesteban2045@gmail.com
```

| Provider | Setup | Free Tier |
|----------|-------|:---------:|
| **SMTP (Gmail)** ✅ *recommended* | App Password from Google | 500/day |
| **Resend** | `RESEND_API_KEY` from [resend.com](https://resend.com) | 100/day |
| **Gmail API** | OAuth2 via Google Cloud Console | 500/day |
| **SendGrid** | `SENDGRID_API_KEY` from Twilio | 100/day |

**2. JSearch API Key (recommended for best results):**

Get a free API key from [RapidAPI/JSearch](https://rapidapi.com/letscrape-6bRBa3Qgu/api/jsearch):

```env
JSEARCH_API_KEY=your-key-here
```

**3. Almacenamiento local (no requiere DB externa):**

Todo se guarda en archivos JSON dentro de `data/` — sin PostgreSQL, sin Docker, sin servicios cloud.

```env
# No DATABASE_URL needed — almacenamiento local en JSON
```

### First Run

```bash
# Full pipeline with CV/PDF extraction
npx tsx scripts/run-profile-pipeline.ts path/to/your-cv.pdf

# Or run the basic pipeline
npm run automate
```

In ~60–90 seconds you'll get a beautiful HTML email with jobs matched to your profile.

---

## 📧 Email Preview

Every digest includes:

| Section | Content |
|---------|---------|
| 📬 **Header** | "Weekly Job Digest" with date |
| 📊 **Stats bar** | Total jobs found, average match score ⭐, best match 🏆 |
| 🙋 **Your Profile** | Skills 🔧, Roles 💼, Location 📍, Level 📈, Languages 🗣️ |
| 📋 **Stats cards** | Jobs Found, Avg Match 🎯, Best Match 🔥 |
| 💼 **Job cards** | Title, Company 🏢, Location 📍, Salary 💰, Source 🌐 |
| 🎯 **Score badge** | Color-coded match score per job |
| 🚀 **View Job CTA** | Direct link to posting |
| 😔 **Empty state** | Friendly message with 🍀 when no jobs found |

> **Note:** Emails are sent with full HTML rendering via SMTP. The HTML fix ensures nodemailer receives and sends the `html` field correctly.

---

## 📦 Features

### ✅ AI PDF Profile Extraction

| Feature | Method | File |
|---------|--------|------|
| Extract profile from CV/PDF | Gemini AI (`gemini-2.0-flash`) | `src/lib/ai/pdfProfileExtractor.ts` |
| Keyword fallback | Regex + keyword matching | `src/lib/ai/pdfProfileExtractor.ts` |
| Build scrape strategy | Queries from extracted profile | `src/lib/ai/scrapeStrategy.ts` |
| Pipeline integration | Full end-to-end | `scripts/run-profile-pipeline.ts` |

**Extracted fields:** Job titles, Skills, Locations, Experience level, Languages

### ✅ Scrapers (5 sources)

| Source | Method | Status | Jobs/Run |
|--------|--------|:------:|:--------:|
| **JSearch** (RapidAPI) | REST API | ✅ Always works | ~10 |
| **Computrabajo** | Python Scrapling | ✅ Stealth browser | ~10 |
| **Indeed** | Python Scrapling | ⚠️ Intermittent | 0–10 |
| **Glassdoor** | Python Scrapling | ⚠️ Intermittent | 0–10 |
| **LinkedIn** | Python Scrapling | ❌ Blocked | 0 |

**Total per run:** ~15–20 jobs (graceful degradation — failed scrapers don't crash)

### ✅ Matching Engine

| Factor | Weight | How it works |
|--------|:------:|--------------|
| Skills | **40%** | Fuzzy matching (Levenshtein distance) against CV skills |
| Interests | **30%** | Job title/industry vs career interests |
| Location | **20%** | Exact city, remote hybrid, partial matches |
| Salary | **10%** | Range overlap, penalizes over-max budgets |

- **Real scores** — no more fake `score: 100`. Every job scored honestly.
- **Color-coded badges:** Excellent (≥80%), Good (≥60%), Potential (<60%)

### ✅ Email Providers

| Provider | Method | HTML | CC | Status |
|----------|--------|:----:|:--:|:------:|
| **SMTP (Gmail)** | App Password | ✅ | ✅ | **Default** |
| **Resend** | API | ✅ | ⚠️ (needs domain) | Available |
| **Gmail API** | OAuth2 | ✅ | ✅ | Available |
| **SendGrid** | API | ✅ | ✅ | Available |

### ✅ Automation

- **Weekly cron** — GitHub Actions (Thu 9 AM UTC)
- **Push trigger** — any push to `main` runs pipeline
- **Manual trigger** via Actions tab or CLI
- **SMTP secrets configured** for CI (no Resend/Gmail OAuth needed)
- **Structured logging** with per-scraper stats
- **3-month cleanup** retention policy

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (main.yml)                     │
│           Push to main + Weekly cron (Thu 9 AM UTC)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Pipeline Entry                                                │
│  scripts/run-profile-pipeline.ts  OR  src/automation/scheduler  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Orchestrator (src/automation/orchestrator.ts)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 0. Extract Profile (if CV/PDF provided)                 │   │
│  │    • Gemini AI extraction from PDF text                  │   │
│  │    • Fallback: keyword extraction                        │   │
│  │    • Build scrape strategy (queries, locations)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Scrape (parallel)                                    │   │
│  │    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│   │
│  │    │ JSearch  │ │Computrab.│ │  Indeed  │ │ Glassdoor││   │
│  │    │ (REST)   │ │(Scrap.)  │ │(Scrap.)  │ │(Scrap.)  ││   │
│  │    └──────────┘ └──────────┘ └──────────┘ └──────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. Score (calculateMatchScore)                          │   │
│  │    • Skills 40%  • Interests 30%                        │   │
│  │    • Location 20% • Salary 10%                          │   │
│  │    • REAL scores — no fake 100%                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. Send Email Digest (SMTP)                             │   │
│  │    • Premium HTML template with emojis 🎯🔥🚀           │   │
│  │    • Real match scores + stats cards                    │   │
│  │    • CC support                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────────────────┐
        │  Python Scrapers (subprocess)                   │
        │  • Scrapling StealthyFetcher                    │
        │  • JSON on stdout → TS bridge                   │
        │  • 3x retry with exp. backoff                   │
        └─────────────────────────────────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────────────────┐
        │  Database (Mock Proxy — DB deferred)            │
        │  • Mock Prisma client → empty/safe defaults     │
        │  • Issue #9: Supabase integration pending       │
        └─────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
seahorse/
├── .github/workflows/
│   └── main.yml                 # Consolidated pipeline (SMTP)
├── .planning/
│   ├── ROADMAP.md               # Roadmap (7 phases)
│   ├── PROJECT.md               # Project overview
│   └── REQUIREMENTS.md          # Requirements spec
├── scrapers/                    # Python Scrapling scrapers
│   ├── shared/                  # Shared Python modules
│   │   ├── base.py              # ScraplingBaseScraper ABC
│   │   ├── models.py            # Job + ScraperResult dataclasses
│   │   ├── config.py            # ScraperConfig from YAML
│   │   └── runner.py            # YAML-driven CLI entrypoint
│   ├── linkedin.py              # LinkedIn scraper
│   ├── glassdoor.py             # Glassdoor scraper
│   ├── computrabajo.py          # Computrabajo scraper
│   ├── indeed.py                # Indeed scraper (Scrapling)
│   └── requirements.txt         # Python dependencies
├── src/
│   ├── automation/
│   │   ├── orchestrator.ts      # Pipeline logic (with profile extraction)
│   │   ├── scheduler.ts         # Entry point
│   │   └── lib/matcher/         # AI matchers (keyword, ollama, gemini, openai)
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── pdfProfileExtractor.ts  # Gemini AI profile extraction
│   │   │   └── scrapeStrategy.ts       # Build queries from profile
│   │   ├── email/
│   │   │   ├── index.ts         # sendEmail() with provider routing
│   │   │   ├── template.ts      # Premium HTML with emojis + scores
│   │   │   ├── gmail.ts         # Gmail OAuth2 provider
│   │   │   └── providers/       # SMTP, Resend, SendGrid
│   │   ├── pdf/                 # PDF parsing, duplicate detection
│   │   ├── cv/                  # CV parsing & skill extraction
│   │   └── prisma.ts            # Mock Prisma client (DB deferred)
│   ├── scrapers/
│   │   ├── index.ts             # ScraperRunner
│   │   ├── bridge/pythonBridge.ts  # TS ↔ Python subprocess bridge
│   │   ├── strategies/          # JSearch API, HTTP scraper
│   │   └── utils/rateLimiter.ts
│   ├── matching/
│   │   ├── scorer.ts            # calculateMatchScore() orchestrator
│   │   ├── skill-matcher.ts     # Fuzzy skill matching
│   │   ├── interest-matcher.ts  # Interest matching
│   │   ├── location-matcher.ts  # Location matching
│   │   └── salary-matcher.ts    # Salary range scoring
│   ├── app/api/                 # Next.js API routes
│   │   ├── cv/upload|process|update-profile
│   │   ├── pdf/upload|match
│   │   ├── email/send
│   │   ├── match-jobs
│   │   └── profile/history
│   └── types/                   # TypeScript interfaces
├── scripts/
│   ├── run-profile-pipeline.ts  # Full pipeline with CV/PDF
│   ├── send-email-digest.ts     # Send digest from CLI
│   ├── test-email.ts            # Quick email test
│   ├── match-jobs.ts            # Test matching engine
│   └── process-cv-uploads.ts    # CV processing
├── scrapers.yaml                # Scraper definitions
└── prisma/schema.prisma         # Database schema (5 models)
```

---

## 🛠️ Available Commands

```bash
# Run the full pipeline with CV/PDF extraction
npx tsx scripts/run-profile-pipeline.ts path/to/cv.pdf

# Run the basic pipeline
npm run automate

# Test email (HTML + plain text)
npx tsx scripts/test-email.ts

# Test matching engine
npx tsx scripts/test-matching.ts

# Run specific scrapers (Python)
python -m scrapers.computrabajo --query "software engineer" --max 5
python -m scrapers.indeed --query "software engineer" --max 5

# Database (when enabled)
npx prisma db push       # Push schema to Supabase
npx prisma generate      # Generate Prisma client
npx prisma studio        # GUI viewer
```

---

## 🔐 Environment Variables

### Email (SMTP — recommended)

| Variable | Description | Required |
|----------|-------------|:--------:|
| `EMAIL_PROVIDER` | `smtp` (recommended) | ✅ |
| `SMTP_HOST` | `smtp.gmail.com` | For SMTP |
| `SMTP_PORT` | `587` | For SMTP |
| `SMTP_USER` | Your Gmail address | For SMTP |
| `SMTP_PASSWORD` | Gmail App Password | For SMTP |
| `SMTP_FROM` | Sender email | For SMTP |
| `GMAIL_RECIPIENT` | Email address for digests | ✅ |
| `EMAIL_CC` | CC address on digests | Optional |

### API Keys

| Variable | Description | Required |
|----------|-------------|:--------:|
| `JSEARCH_API_KEY` | RapidAPI JSearch key | For JSearch |
| `GEMINI_API_KEY` | Google Gemini API key | For AI extraction |

### Email Providers (Alternatives)

| Variable | Description | For |
|----------|-------------|-----|
| `RESEND_API_KEY` | Resend API key | Resend |
| `RESEND_FROM_EMAIL` | Resend sender | Resend |
| `SENDGRID_API_KEY` | SendGrid API key | SendGrid |
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID | Gmail API |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret | Gmail API |
| `GMAIL_REFRESH_TOKEN` | Gmail refresh token | Gmail API |

### Almacenamiento Local

| Variable | Description | Required |
|----------|-------------|:--------:|
| `data/` | Directorio con archivos JSON | Creado automáticamente |

---

## 📊 Pipeline Performance

| Source | Avg Jobs | Reliability | Method |
|--------|:--------:|:-----------:|--------|
| JSearch | ~10 | ⭐⭐⭐⭐⭐ | REST API |
| Computrabajo | ~10 | ⭐⭐⭐⭐ | Python Scrapling |
| Indeed | 0–10 | ⭐⭐⭐ | Python Scrapling |
| Glassdoor | 0–10 | ⭐⭐⭐ | Python Scrapling |
| LinkedIn | 0 | ⭐ | Anti-bot (blocked) |

**Total:** ~15–20 jobs per run, delivered in ~60–90s.

---

## 🧪 Testing

```bash
# Full pipeline with profile extraction
npx tsx scripts/run-profile-pipeline.ts my-cv.pdf

# Email only
npx tsx scripts/test-email.ts

# Matching engine test
npx tsx scripts/test-matching.ts

# GitHub Actions
# Actions → Pipeline Principal → Run workflow
```

---

## 🗺️ Roadmap & Issues

| # | Phase | Status | Issue |
|---|-------|--------|-------|
| 1 | Job Board Scraper | ✅ **Complete** | — |
| 2 | AI Job Matching | ✅ **Complete** | — |
| 3 | Email Notifications (HTML + emojis + scores) | ✅ **Complete** | — |
| 4 | Automation & Scheduling (SMTP in CI) | ✅ **Complete** | — |
| 5 | AI PDF Profile Extraction | ✅ **Complete** | [#7](https://github.com/byAyes/SeaHorse/issues/7) ✅ |
| 6 | ~~Supabase Database Integration~~ (bloqueado por IPv6) | 🔴 **Cancelado** | [#9](https://github.com/byAyes/SeaHorse/issues/9) |
| 7 | Frontend UI Dashboard (React) | ✅ **Completado** | [#8](https://github.com/byAyes/SeaHorse/issues/8) |
| 8 | Refactor: Base de datos local (JSON) — reemplazar Prisma + Supabase por archivos JSON | 🔜 **Planificado** | Ver `.planning/REFACTOR-local-database.md` |

### Open Issues

| # | Title | State |
|---|-------|-------|
| # | Title | State |
|---|-------|-------|
| [#10](https://github.com/byAyes/SeaHorse/issues/10) | Refactor: Almacenamiento local JSON en vez de DB externa | 🟢 Open |
| [#8](https://github.com/byAyes/SeaHorse/issues/8) | Frontend UI — Dashboard React | 🔵 Closed ✅ |
| [#9](https://github.com/byAyes/SeaHorse/issues/9) | Integración Supabase — reemplazar mock Prisma | 🔵 Closed (reemplazado por #10) |

### Closed Issues

| # | Title | State |
|---|-------|-------|
| [#7](https://github.com/byAyes/SeaHorse/issues/7) | AI PDF profile extraction | 🔵 Closed ✅ |
| [#6](https://github.com/byAyes/SeaHorse/issues/6) | process-cv pipeline (absorbed) | 🔵 Closed |
| [#9](https://github.com/byAyes/SeaHorse/issues/9) | Integración Supabase (reemplazado por #10) | 🔵 Closed

---

## 🚢 GitHub Actions

The workflow runs on **push to `main`** and also **weekly (Thu 9 AM UTC)**:

```yaml
# .github/workflows/main.yml
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'scrapers/**'
      - 'scripts/**'
      - 'package.json'
      - 'scrapers.yaml'
      - '.github/workflows/**'
  schedule:
    - cron: '0 9 * * 4'
  workflow_dispatch:
```

**Required secrets for CI (SMTP):**

| Secret | Value |
|--------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail |
| `SMTP_PASSWORD` | Gmail App Password |
| `SMTP_FROM` | Your Gmail |
| `GMAIL_RECIPIENT` | Destination email |
| `EMAIL_CC` | (optional) CC address |
| `JSEARCH_API_KEY` | RapidAPI key |

---

## 🧰 Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js (CommonJS) + `tsx` |
| **AI Profile Extraction** | Gemini Flash (`gemini-2.0-flash`) |
| **Scraping** | Python 3.12 + Scrapling StealthyFetcher |
| **Matching** | TypeScript — weighted scoring (40/30/20/10), Levenshtein |
| **Email** | SMTP (primary), Resend, Gmail OAuth2, SendGrid |
| **HTML Email** | Premium template with emojis, SVG icons, score badges |
| **Storage** | Local JSON files (`data/`) — 0 config, 0 dependencias externas | 🔜 #10
| **API** | Next.js App Router |
| **CI/CD** | GitHub Actions (push + weekly cron) |
| **Planning** | GSD (Get Shit Done) — 7 phases completed |

---

## 🤝 Contributing

This is a personal automation project. Fork and adapt for your own job search!

**Ideas for contributions:**
- New scraper for another job board
- LinkedIn anti-bot bypass strategy
- Dashboard UI (see [#8](https://github.com/byAyes/SeaHorse/issues/8))
- Supabase integration (see [#9](https://github.com/byAyes/SeaHorse/issues/9))
- Push notifications (Telegram, Slack)

---

## 📝 License

ISC License — See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **[Scrapling](https://github.com/D4V1D-123/scrapling)** — Python stealth browser library
- **[JSearch](https://rapidapi.com/letscrape-6bRBa3Qgu/api/jsearch)** — Free jobs API
- **[Resend](https://resend.com)** — Email delivery
- **[Prisma](https://prisma.io)** — Type-safe ORM
- **[Google Gemini](https://deepmind.google/gemini/)** — AI profile extraction
- **GSD Framework** — Structured planning methodology

---

<div align="center">

**Built with ❤️ for efficient job searching**

[View on GitHub](https://github.com/byAyes/SeaHorse) • [Issues](https://github.com/byAyes/SeaHorse/issues) • [Roadmap](.planning/ROADMAP.md)

</div>
