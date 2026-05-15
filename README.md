# 🐴 Seahorse — Job Email Automation

> **Automated job board scraping with AI-powered matching, delivered to your inbox weekly in beautiful HTML.**

[![Status](https://img.shields.io/badge/status-production-success)](https://github.com/byAyes/automatitation)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/byAyes/automatitation/weekly-job-email.yml?branch=main)](https://github.com/byAyes/automatitation/actions)

---

## 🎯 What It Does

Seahorse automates your job search by scraping **5+ sources**, matching jobs against your profile with **weighted AI scoring**, and sending you a **beautiful HTML email digest** every week.

```
Scrape → Match → Filter → Email → Done.
```

### Pipeline Overview

| Step | What | Sources |
|:----:|------|---------|
| ① | **Scrape** job boards | JSearch API, Indeed, Glassdoor, Computrabajo, LinkedIn |
| ② | **Match** against profile | Skills (40%), Interests (30%), Location (20%), Salary (10%) |
| ③ | **Filter** for relevance | >70% match threshold, dedup, date filtering |
| ④ | **Email** curated digest | Beautiful HTML email with CC support |
| ⑤ | **Cleanup** old jobs | 3-month retention policy |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **Python 3.12+**
- **Resend** account (free — 100 emails/day) or Gmail API credentials
- **(Optional)** PostgreSQL database (pipeline works without it via mock proxy)

### Installation

```bash
# Clone
git clone https://github.com/byAyes/automatitation.git
cd automatitation

# Node dependencies
npm install

# Python dependencies (for Scrapling scrapers)
pip install -r scrapers/requirements.txt

# Install Playwright browsers (required by Scrapling StealthyFetcher)
playwright install chromium
patchright install chromium

# Copy environment
cp .env.example .env
```

### Configuration

**1. Email Provider (pick one):**

| Provider | Setup | Free Tier |
|----------|-------|:---------:|
| **Resend** (recommended) | `RESEND_API_KEY` from [resend.com](https://resend.com) | 100/day |
| **Gmail** | OAuth2 via Google Cloud Console | 500/day |
| **SendGrid** | `SENDGRID_API_KEY` from Twilio | 100/day |
| **SMTP** | Standard SMTP credentials | — |

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
GMAIL_RECIPIENT=you@email.com

# Optional: CC someone else on every digest
# CC_EMAIL=juanesteban2045@gmail.com
```

**2. JSearch API Key (recommended for best results):**

Get a free API key from [RapidAPI/JSearch](https://rapidapi.com/letscrape-6bRBa3Qgu/api/jsearch):

```env
JSEARCH_API_KEY=your-key-here
```

**3. Database (optional — pipeline works without it):**

The pipeline uses a **mock database proxy** by default — all jobs pass through, no persistence needed.

To enable real storage, set:
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### First Run

```bash
npm run automate
```

In ~60 seconds you'll get a beautiful HTML email with jobs from up to 5 sources.

---

## 📧 Email Preview

Every digest includes:
- **Stats bar** — total jobs, average match score, best match
- **Job cards** — title, company, location, salary, skills pills
- **Match score badges** — color-coded (≥80% green, ≥60% amber, <60% red)
- **"View Job →"** buttons linking directly to postings
- **Plain text fallback** for email clients that don't support HTML

> **Note:** CC is supported (e.g., `juanesteban2045@gmail.com`) but requires a verified custom domain in Resend. The free `onboarding@resend.dev` sender only delivers to the registered email.

---

## 📦 Features

### ✅ Scrapers (5 sources)

| Source | Method | Status | Jobs/Run |
|--------|--------|:------:|:--------:|
| **JSearch** (RapidAPI) | REST API | ✅ Always works | 10 |
| **Indeed** | Python Scrapling | ✅ Stealth browser | 10 |
| **Glassdoor** | Python Scrapling | ✅ Stealth browser | 10 |
| **Computrabajo** | Python Scrapling | ✅ Stealth browser | 10 |
| **LinkedIn** | Python Scrapling | ⚠️ Anti-bot (0 jobs) | — |

**Total per run:** ~30–40 jobs

### ✅ Matching Engine

- **Weighted scoring**: Skills (40%), Interests (30%), Location (20%), Salary (10%)
- **Fuzzy skill matching** via Levenshtein distance
- **Partial interest matching** — substring containment scores proportionally
- **Location flexibility** — exact city, remote hybrid, partial matches
- **Salary sanity** — penalizes over-max budgets

### ✅ Email Providers

- **Resend** — primary, beautiful HTML + plain text multipart
- **Gmail** — OAuth2, multipart/alternative MIME
- **SendGrid** — API-based fallback
- **SMTP** — generic SMTP fallback

### ✅ Automation

- **Weekly cron** — GitHub Actions (Thu 9 AM UTC)
- **Manual trigger** via Actions tab or CLI
- **Job deduplication** by URL + email history
- **3-month cleanup** retention policy
- **Structured logging** with per-scraper stats

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions (Weekly Cron)                │
│            Every Thursday at 9:00 AM UTC                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Scheduler (src/automation/scheduler.ts)                 │
│  • Entry point  • Error handling  • Structured logging   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────────┐
│  Orchestrator (src/automation/orchestrator.ts)             │
│                                                           │
│  ┌───────────────────────────────────────────────────┐    │
│  │ 1. Scrape (parallel)                              │    │
│  │    ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────┐ │    │
│  │    │ JSearch  │ │  Indeed  │ │ Glassdoor │ │ ...│ │    │
│  │    │ (REST)   │ │(Scrapling)│ │(Scrapling)│ │    │ │    │
│  │    └─────────┘ └──────────┘ └───────────┘ └────┘ │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │ 2. Filter & Match                                  │    │
│  │    • Dedup by URL  • Weighted scoring (4 axes)     │    │
│  │    • >70% threshold  • Date filtering              │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │ 3. Send Email Digest                               │    │
│  │    • Beautiful HTML template  • CC support         │    │
│  │    • Resend/Gmail/SendGrid/SMTP                    │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │ 4. Cleanup                                         │    │
│  │    • Remove jobs > 3 months  • Log scraper stats   │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐
        │  Python Scrapers (subprocess)   │
        │  • Scrapling StealthyFetcher    │
        │  • JSON on stdout to TS bridge  │
        │  • 3x retry with exp. backoff   │
        └─────────────────────────────────┘
```

### Data Flow: TypeScript ↔ Python

```
┌──────────────────────────────────────┐
│  ScraperRunner (TS)                  │
│  src/scrapers/index.ts               │
│                                      │
│  For each scraper in scrapers.yaml:  │
│    → pythonBridge.ts:                 │
│      spawn("python", ["-m", module]) │
│        │                              │
│        ▼                              │
│  ┌──────────────────────────────┐    │
│  │  Python Scraper              │    │
│  │  ScraplingBaseScraper        │    │
│  │  • StealthyFetcher.fetch()   │    │
│  │  • Parse CSS selectors       │    │
│  │  • print(ScraperResult JSON) │    │
│  └──────────────────────────────┘    │
│        │                              │
│        ▼                              │
│  ← JSON parsed, stderr → logs       │
└──────────────────────────────────────┘
```

---

## 📂 Project Structure

```
seahorse/
├── .github/workflows/          # GitHub Actions automation
│   ├── weekly-job-email.yml    # Weekly digest (Thu 9 AM)
│   └── cv-job-processing.yml   # CV processing pipeline
├── scrapers/                   # Python Scrapling scrapers
│   ├── shared/                 # Shared Python modules
│   │   ├── base.py             # ScraplingBaseScraper ABC
│   │   ├── models.py           # Job + ScraperResult dataclasses
│   │   ├── config.py           # ScraperConfig from YAML
│   │   └── runner.py           # YAML-driven CLI entrypoint
│   ├── linkedin.py             # LinkedIn scraper
│   ├── glassdoor.py            # Glassdoor scraper
│   ├── computrabajo.py         # Computrabajo scraper
│   ├── indeed.py               # Indeed scraper (NEW — Scrapling)
│   └── requirements.txt        # Python dependencies
├── src/
│   ├── automation/             # Pipeline orchestration
│   │   ├── scheduler.ts        # Entry point
│   │   ├── orchestrator.ts     # Pipeline logic
│   │   └── lib/matcher/        # AI matchers (keyword, ollama, gemini, openai)
│   ├── scrapers/               # TypeScript scraper layer
│   │   ├── index.ts            # ScraperRunner (orchestrates all)
│   │   ├── bridge/pythonBridge.ts  # TS ↔ Python subprocess bridge
│   │   ├── strategies/         # TS-native scrapers
│   │   │   ├── jsearch.ts      # JSearch REST API
│   │   │   ├── indeed.ts       # Old HTTP indeed (now unused)
│   │   │   └── httpScraper.ts  # HTTP base class
│   │   └── utils/rateLimiter.ts
│   ├── lib/
│   │   ├── email/              # Multi-provider email
│   │   │   ├── index.ts        # sendEmail() with provider routing
│   │   │   ├── template.ts     # Beautiful HTML + plain text
│   │   │   ├── gmail.ts        # Gmail OAuth2 provider
│   │   │   └── providers/      # Resend, SendGrid, SMTP
│   │   ├── automation/         # Job history, dedup, logging
│   │   ├── cv/                 # CV parsing & skill extraction
│   │   ├── pdf/                # PDF job detection
│   │   └── prisma.ts           # Prisma singleton (mock proxy)
│   ├── matching/               # Weighted scoring engine
│   │   ├── scorer.ts           # Main scoring orchestrator
│   │   ├── skill-matcher.ts    # Fuzzy skill matching
│   │   ├── interest-matcher.ts # Interest matching
│   │   ├── location-matcher.ts # Location matching
│   │   └── salary-matcher.ts   # Salary range scoring
│   ├── app/api/                # Next.js API routes
│   └── types/                  # TypeScript interfaces
├── scripts/                    # CLI utilities
│   ├── send-email-digest.ts    # Send test digest
│   ├── test-email.ts           # Quick email test
│   ├── match-jobs.ts           # Test matching engine
│   └── get-gmail-tokens.js     # Gmail OAuth setup
├── scrapers.yaml               # Scraper definitions (config-driven)
├── prisma/schema.prisma        # Database schema
└── .planning/                  # GSD planning docs (12 phases)
```

---

## 🛠️ Available Commands

```bash
# Run the full pipeline
npm run automate

# Run specific scrapers directly (Python)
python -m scrapers.indeed --query "software engineer" --max 5
python -m scrapers.glassdoor --query "software engineer" --max 5

# Test email (HTML + plain text)
npx tsx scripts/test-email.ts

# Database (when enabled)
npx prisma db push       # Push schema
npx prisma generate      # Generate client
npx prisma studio        # GUI viewer

# Gmail OAuth setup (if using Gmail provider)
node scripts/get-gmail-tokens.js
```

---

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|:--------:|
| `EMAIL_PROVIDER` | `resend` \| `gmail` \| `sendgrid` \| `smtp` | ✅ |
| `GMAIL_RECIPIENT` | Email address for digests | ✅ |
| `RESEND_API_KEY` | Resend API key | For Resend |
| `JSEARCH_API_KEY` | RapidAPI JSearch key | For JSearch |
| `DATABASE_URL` | PostgreSQL connection | Optional |
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID | For Gmail |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret | For Gmail |
| `GMAIL_ACCESS_TOKEN` | Gmail access token | For Gmail |
| `GMAIL_REFRESH_TOKEN` | Gmail refresh token | For Gmail |
| `SENDGRID_API_KEY` | SendGrid API key | For SendGrid |
| `CC_EMAIL` | CC address on digests | Optional |

See `.env.example` for full template.

---

## 📊 Pipeline Performance

| Scraper | Avg Jobs | Reliability | Method |
|---------|:--------:|:-----------:|--------|
| JSearch | 10 | ⭐⭐⭐⭐⭐ | REST API (always works) |
| Indeed | 10 | ⭐⭐⭐⭐ | Scrapling Stealth |
| Glassdoor | 10 | ⭐⭐⭐⭐ | Scrapling Stealth |
| Computrabajo | 10 | ⭐⭐⭐⭐ | Scrapling Stealth |
| LinkedIn | 0 | ⭐ | Anti-bot (blocked) |

**Total:** ~30–40 jobs per run, delivered in ~60s.

---

## 🧪 Testing

```bash
# Full pipeline test
npm run automate

# Email only
npx tsx scripts/test-email.ts

# Matching engine test
npx tsx scripts/test-matching.ts

# GitHub Actions
# Actions → Weekly Job Email Automation → Run workflow
```

---

## 📈 Roadmap

### Phase 1: Job Board Scraper ✅
- [x] Foundation and base scraper
- [x] Indeed, LinkedIn, Glassdoor scrapers
- [x] Puppeteer → Scrapling migration (Python subprocess)

### Phase 2: AI Job Matching ✅
- [x] Weighted scoring (Skills 40%, Interests 30%, Location 20%, Salary 10%)
- [x] Fuzzy skill matching (Levenshtein)
- [x] Multiple AI matchers (keyword, ollama, gemini, openai)

### Phase 3: Email Notifications ✅
- [x] Multi-provider (Resend, Gmail, SendGrid, SMTP)
- [x] Beautiful HTML email template with job cards
- [x] Plain text fallback
- [x] CC support

### Phase 4: Automation & Scheduling ✅
- [x] GitHub Actions weekly cron (Thu 9 AM UTC)
- [x] Job history, dedup, 3-month cleanup
- [x] Structured logging with scraper stats

### Phase 5: PDF Job Detection ✅
- [x] PDF upload, parsing, skill extraction
- [x] Duplicate detection

### Phase 6: CV Database ✅
- [x] CV versioning, profile auto-update
- [x] Change history logging

### Future Enhancements
- [ ] **LinkedIn** — resolve anti-bot (cookie injection, residential proxies)
- [ ] **Multi-user** — per-user profiles + email schedules
- [ ] **Dashboard** — web UI for jobs, matches, history
- [ ] **Real-time alerts** — push notifications for high-match jobs
- [ ] **Custom domain** — verify domain in Resend to enable CC delivery
- [ ] **Better location/remote detection** from job descriptions

---

## 🚢 GitHub Actions

The workflow runs every Thursday at 9:00 AM UTC:

```yaml
# .github/workflows/weekly-job-email.yml
on:
  schedule:
    - cron: '0 9 * * 4'   # Thursday 9 AM UTC
  workflow_dispatch:        # Manual trigger
```

**Required secrets** for CI:
- `JSEARCH_API_KEY` — RapidAPI key
- `EMAIL_PROVIDER`, `RESEND_API_KEY`, `GMAIL_RECIPIENT`
- For Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_*_TOKEN`
- `DATABASE_URL` (optional)

---

## 🧰 Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js (CommonJS) + `tsx` |
| **Scraping** | Python 3.12 + Scrapling (StealthyFetcher) |
| **Matching** | TypeScript — weighted scoring, Levenshtein, AI providers |
| **Email** | Resend (primary), Gmail OAuth2, SendGrid, SMTP |
| **Database** | PostgreSQL via Prisma ORM (deferred) |
| **API** | Next.js App Router |
| **CI/CD** | GitHub Actions (weekly cron) |
| **Planning** | GSD (Get Shit Done) — 12-phase methodology |

---

## 🤝 Contributing

This is a personal automation project. Fork and adapt for your own job search!

**Ideas for contributions:**
- New scraper for another job board
- LinkedIn anti-bot bypass strategy
- Dashboard UI for profile management
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
- **GSD Framework** — Structured planning methodology

---

<div align="center">

**Built with ❤️ for efficient job searching**

[View on GitHub](https://github.com/byAyes/automatitation) • [Report Issue](https://github.com/byAyes/automatitation/issues)

</div>
