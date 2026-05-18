# Seahorse — Job Email Automation

## Project Skills

> 📖 **Always read `AGENTS.md` in the project root** — it defines the active skills for this project.
> The AI assistant MUST load the listed skills when working on relevant tasks:
>
> | Skill            | Purpose                                                        |
> | ---------------- | -------------------------------------------------------------- |
> | `ui-ux-pro-max`  | Premium design system, semantic palettes, editorial typography |
> | `superpowers`    | Discover and use available skills for development              |
> | `agentic-skills` | Orchestrate multi-agent workflows and parallel agents          |

## What This Is

Automated job board scraper → AI profile extraction → AI matcher → email digest pipeline. Upload a CV/PDF, it extracts your profile via Gemini AI, scrapes 5+ sources, scores jobs with weighted matching, and sends a beautiful HTML email with emojis and real match scores.

## Commands

| Command                                                  | Purpose                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| `npx tsx scripts/run-profile-pipeline.ts path/to/cv.pdf` | Full pipeline: extract profile → scrape → score → email        |
| `npm run automate`                                       | Run the basic pipeline (scrape → email, no profile extraction) |
| `npx tsx scripts/test-email.ts`                          | Test email sending (HTML)                                      |
| `npx tsx scripts/test-matching.ts`                       | Test matching engine                                           |
| `pip install -r scrapers/requirements.txt`               | Install Python scraper deps                                    |
| `playwright install chromium`                            | Install browser for Scrapling                                  |
| `patchright install chromium`                            | Install patched browser for Scrapling                          |

## Key Code Locations

- **Pipeline with profile** → `scripts/run-profile-pipeline.ts` → `src/automation/orchestrator.ts`
- **Pipeline (basic)** → `src/automation/scheduler.ts` → `src/automation/orchestrator.ts`
- **AI Profile Extraction** → `src/lib/ai/pdfProfileExtractor.ts` (Gemini + keyword fallback)
- **Scrape Strategy Builder** → `src/lib/ai/scrapeStrategy.ts`
- **Scrapers** → TypeScript bridge (`src/scrapers/`), Python subprocess (`scrapers/`)
- **Matching** → `src/matching/` (scorer.ts, skill-matcher, location-matcher, salary-matcher, interest-matcher)
- **Email** → `src/lib/email/` (SMTP/Resend/SendGrid/Gmail providers)
- **Email Template** → `src/lib/email/template.ts` (Premium HTML + emojis + scores)
- **Scraper config** → `scrapers.yaml`

## Architecture Notes

- **Typescript (CommonJS)** with `tsx` runtime
- **AI Extraction**: Gemini Flash (`gemini-2.0-flash`). Falls back to keyword extraction if API key not set.
- **Email**: SMTP (Gmail App Password) is the **default** provider. Resend, Gmail API, SendGrid as alternatives.
  - Provider routing reads `EMAIL_PROVIDER` env var at call time (lazy init).
  - SMTP was fixed to properly pass `html` and `cc` to nodemailer.
- **Python scrapers**: Spawned as subprocesses via `pythonBridge.ts`. Use Scrapling library.
- **Matching**: Weighted scoring (Skills 40% / Interests 30% / Location 20% / Salary 10%) — **real scores, no fake 100%**.
- **Email template**: Premium HTML with emojis (📬📊🎯🔥🚀), SVG icons, score badges, stats cards, empty state.

## Database → Local Storage 🔜

**PRÓXIMO REFACTOR:** Reemplazar la base de datos externa (Supabase/Neon mock) por **almacenamiento local en archivos JSON** (`data/database.json`).

Actualmente el pipeline usa un mock de PrismaClient que retorna defaults vacíos (los datos no persisten entre ejecuciones). El plan de refactor consiste en:

- **0 config:** No necesita `DATABASE_URL`, ni Docker, ni servicios cloud
- **Persistencia real:** Los datos se guardan en disco y sobreviven reinicios
- **Portable:** Clonar + npm install + ejecutar = funciona
- **Estructura:** `src/lib/local-data/` con stores individuales por entidad
- **Compatibilidad:** `src/lib/prisma.ts` como wrapper sobre `LocalData`

**Tracked in:** [#10 — Refactor a almacenamiento local JSON](https://github.com/byAyes/SeaHorse/issues/10)
**Plan detallado:** `.planning/REFACTOR-local-database.md`

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

## Scraper Performance

| Source       | Method           |     Status      | Jobs/Run |
| ------------ | ---------------- | :-------------: | :------: |
| JSearch API  | REST API         | ✅ Always works |   ~10    |
| Computrabajo | Python Scrapling |   ✅ Reliable   |   ~10    |
| Indeed       | Python Scrapling | ⚠️ Intermittent |   0–10   |
| Glassdoor    | Python Scrapling | ⚠️ Intermittent |   0–10   |
| LinkedIn     | Python Scrapling |   ❌ Blocked    |    0     |

Total per run: **~15–20 jobs** — failed scrapers don't crash the pipeline.

## CI (GitHub Actions)

- **Workflow:** `.github/workflows/main.yml` (consolidated — single workflow)
- **Triggers:** Push to `main`, weekly cron (Thu 9 AM UTC), manual dispatch
- **Email:** SMTP via Gmail App Password secrets
- **Python deps:** Installed at runtime via `pip install -r scrapers/requirements.txt`
- **Browser:** Chrome/Chromium installed for Scrapling StealthyFetcher

### Required CI Secrets

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `GMAIL_RECIPIENT`, `EMAIL_CC`, `JSEARCH_API_KEY`

## Open Issues

| #   | Title                               | Link                                         |
| --- | ----------------------------------- | -------------------------------------------- |
| 10  | Refactor: Almacenamiento local JSON | https://github.com/byAyes/SeaHorse/issues/10 |

## Closed Issues

| #   | Title                     | Resolution                          |
| --- | ------------------------- | ----------------------------------- |
| 7   | AI PDF profile extraction | ✅ Implemented and working          |
| 6   | process-cv pipeline       | ✅ Absorbed into #7 + #9            |
| 8   | Frontend UI Dashboard     | ✅ Completado                       |
| 9   | Integración Supabase      | 🔁 Reemplazado por #10 (local JSON) |

## Recent Fixes

- **SMTP HTML**: Provider now accepts `html` and `cc` params — emails render with rich formatting (was plain text only)
- **Real match scores**: Orchestrator builds `UserProfile` from extracted CV, calls `calculateMatchScore()` — no more fake `score: 100`
- **Emojis in template**: Added throughout digest: header, stats, profile, job cards, empty state, footer
- **CI email switch**: Changed from Resend to SMTP (Gmail App Password) — more reliable
- **Workflow path fix**: Added `.github/workflows/**` to trigger paths — workflow changes now trigger runs
- **Local storage refactor**: Reemplazado Prisma + Supabase por archivos JSON locales
