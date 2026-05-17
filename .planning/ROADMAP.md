# Roadmap: Job Offer Email Automation (Seahorse)

**Created:** 2026-03-25 · **Last updated:** 2026-05-15
**Repository:** [byAyes/SeaHorse](https://github.com/byAyes/SeaHorse)

---

## Overview

| # | Phase | Goal | Status | Issues |
|---|-------|------|--------|--------|
| 1 | Job Board Scraper | Scrape jobs from LinkedIn, Indeed, Glassdoor, Computrabajo, JSearch | ✅ **Complete** | — |
| 2 | AI Job Matching | Score jobs against user profile with weighted algorithm | ✅ **Complete** | — |
| 3 | Email Notifications | Send weekly digests with HTML template + emojis | ✅ **Complete** | — |
| 4 | Automation & Scheduling | GitHub Actions weekly pipeline | ✅ **Complete** | — |
| 5 | PDF Profile Extraction | Extract job profile from CV/PDF with Gemini AI | ✅ **Complete** | #7 ✅ |
| 6 | ~~Supabase Database Integration~~ (IPv6 block) | 🔴 **Cancelado** → reemplazado por Fase 8 | #9 🔁 #10 |
| 7 | Frontend UI Dashboard | React SPA for pipeline management | ✅ **Complete** | #8 ✅ |
| 8 | **Refactor: Almacenamiento Local JSON** | Reemplazar Prisma + Supabase por archivos JSON locales, 0 config de DB | 🔜 **Planificado** | #10 |

---

## Phase 1: Job Board Scraper ✅

**Goal:** Scrape job listings from multiple sources — web scrapers + API.

**Sources:**

| Scraper | Type | Status | Notes |
|---------|------|--------|-------|
| JSearch API | REST API | ✅ **Working** | ~10 jobs per run, free tier |
| Computrabajo | Python (Scrapling) | ✅ **Working** | ~10 jobs per run |
| Indeed | Python (Scrapling) | ⚠️ **Intermittent** | 403/blocking, fallback graceful |
| LinkedIn | Python (Scrapling) | ⚠️ **Intermittent** | Login wall/rate limits |
| Glassdoor | Python (Scrapling) | ⚠️ **Intermittent** | Anti-bot measures |

**Features:**
- ✅ Rate limiter with configurable delays
- ✅ Python subprocess bridge (`pythonBridge.ts`)
- ✅ HTTP fallback scraper for basic sites
- ✅ Configurable via `scrapers.yaml`
- ✅ Graceful degradation — failed scrapers don't crash the pipeline

---

## Phase 2: AI Job Matching ✅

**Goal:** Score jobs against user profile for relevance.

**Algorithm — Weighted scoring:**

| Factor | Weight | Source |
|--------|--------|--------|
| Skills match | **40%** | CV extracted skills vs job description |
| Interests match | **30%** | Job titles/industry vs user interests |
| Location match | **20%** | Job location vs preferred locations + remote |
| Salary match | **10%** | Job salary vs min/max range |

**Features:**
- ✅ `calculateMatchScore()` in `src/matching/scorer.ts`
- ✅ Individual matchers: skill, interest, location, salary
- ✅ Scores are **honest** — no more fake `score: 100`
- ✅ `matchJobs()` in `src/matching/cvMatcher.ts`
- ✅ Profile built from CV extraction (skills, titles, locations, level)
- ✅ API endpoint at `/api/match-jobs`

---

## Phase 3: Email Notifications ✅

**Goal:** Send weekly job digest emails with rich HTML formatting.

**Email Providers:**

| Provider | Method | Status | Notes |
|----------|--------|--------|-------|
| **SMTP (Gmail)** | App Password | ✅ **Default** | HTML + CC support fixed |
| Resend | API | ✅ Available | Free tier (100/day) |
| Gmail API | OAuth2 | ✅ Available | Tokens refresh required |

**Features:**
- ✅ **Premium HTML template** with SVG icons and gradients
- ✅ **Emojis** throughout: 📬 header, 📊 stats, 🎯 scores, 🚀 CTA, 🐴💨 footer
- ✅ **Real match scores** displayed per job — no more fake 100%
- ✅ **Profile section**: skills, roles, location, languages
- ✅ **Stats cards**: Jobs Found, Avg Match, Best Match
- ✅ **Empty state**: friendly message with 😔🍀
- ✅ **CC support** via `EMAIL_CC` env var
- ✅ Provider routing via `EMAIL_PROVIDER` env var (lazy init)

---

## Phase 4: Automation & Scheduling ✅

**Goal:** Run the full pipeline on a schedule without manual intervention.

**Infrastructure:**

| Component | Detail | Status |
|-----------|--------|--------|
| Storage | Local JSON files (`data/database.json`) — 0 dependencias externas | 🔜 **Planificado (#10)** |
|-----------|--------|--------|
| GitHub Actions | `.github/workflows/main.yml` | ✅ **Running** |
| Trigger | Push to `main` + weekly cron (Thu 9 AM UTC) | ✅ |
| Email provider | SMTP (Gmail App Password) via secrets | ✅ Configurado |
| Python deps | `scrapers/requirements.txt` | ✅ |
| Browser | Chrome/Chromium install step | ✅ |
| Paths filter | `.github/workflows/**` included | ✅ Fixed |

**Pipeline flow:**
```
Trigger → Install deps → Run scraper → Match jobs → Send email → Cleanup
```

**Recent fixes:**
- ✅ SMTP provider now sends HTML (was plain text only)
- ✅ CI switched from Resend to SMTP (more reliable)
- ✅ Workflow path filter added (changes to `.github/workflows` now trigger runs)
- ✅ Secrets mapped: SMTP_HOST/PORT/USER/PASSWORD/FROM

---

## Phase 5: PDF Profile Extraction ✅ *(formerly "PDF Job Detection")*

**Goal:** Extract user profile from uploaded CV/PDF to drive intelligent job scraping.

**Feature:** `AI PDF profile extraction for intelligent job scraping` — **Closed** ✅

| Component | File | Status |
|-----------|------|--------|
| Gemini AI extraction | `src/lib/ai/pdfProfileExtractor.ts` | ✅ Gemini Flash |
| Keyword fallback | `src/lib/ai/pdfProfileExtractor.ts` | ✅ When AI unavailable |
| Scrape strategy builder | `src/lib/ai/scrapeStrategy.ts` | ✅ Queries from profile |
| PDF parsing | `src/lib/pdf/pdfParser.ts` | ✅ |
| Pipeline integration | `src/automation/orchestrator.ts` | ✅ |
| Pipeline entry script | `scripts/run-profile-pipeline.ts` | ✅ |

**Extracted profile fields:**
- ✅ Job titles (career targets)
- ✅ Skills (technical + soft)
- ✅ Preferred locations
- ✅ Experience level (junior/mid/senior)
- ✅ Languages
- ✅ Scrape queries built from profile

**Last pipeline run:** 20 jobs scraped, scored with real scores, sent via SMTP ✅

---

## Phase 6: CV Database & Auto-Update 🔴 Cancelado

**Goal:** Persist all data in Supabase (PostgreSQL) for history, dedup, and dashboard.

**Status:** ❌ **Cancelado** — Bloqueado por conectividad IPv6 con Supabase desde Windows.

**Issue:** [#9 — Integración Supabase](https://github.com/byAyes/SeaHorse/issues/9) → **Reemplazado por #10**

**Motivo:** Supabase solo resuelve hostnames IPv6 desde ciertos ISP/configuraciones de red en Windows, haciendo imposible la conexión directa.

**Resolución:** En lugar de luchar con conectividad cloud, se optó por **almacenamiento local en archivos JSON** — ver Fase 8.

| Requirement | Status | Notes |
|-------------|--------|-------|
| CV-01: Store CVs with versioning | ✅ **Refactorizado en Fase 8** | JSON local |
| CV-02: Auto-extract skills from CV | ✅ **Done in #7** | — |
| CV-03: Update profile from CV | ✅ **Done in #7** | — |
| CV-04: Use profile for matching | ✅ **Done in #7** | — |
| CV-05: Track profile changes | ✅ **Refactorizado en Fase 8** | JSON local |

---

## Phase 7: Frontend UI Dashboard ✅

**Goal:** React SPA to manage the pipeline visually — no more CLI/`.env` config.

**Issue:** [#8 — Frontend UI Dashboard](https://github.com/byAyes/SeaHorse/issues/8)

**Status:** ✅ **Completado**

**Features implementadas:**
- 📄 PDF drag & drop upload zone
- 📧 Email configuration form (SMTP, destination, CC)
- 📊 Dashboard with job stats, scores, history
- ⚡ Manual pipeline trigger with progress bar
- 💼 Job table with filters and scores
- ⚙️ Settings (API keys, profile management)
- 🌙 Dark/light mode
- 🎬 Micro-interacciones con Framer Motion (animaciones, transiciones)

**Stack usado:**
- Next.js App Router · Tailwind CSS · Framer Motion · Recharts

---

## Phase 8: Refactor — Almacenamiento Local JSON 🔜

**Goal:** Eliminar toda dependencia de base de datos externa. Reemplazar Prisma + PostgreSQL por archivos JSON locales.

**Issue:** [#10 — Refactor a almacenamiento local JSON](https://github.com/byAyes/SeaHorse/issues/10)

**Documento detallado:** `.planning/REFACTOR-local-database.md`

**Motivación:**
- 🚫 **0 config**: No más `DATABASE_URL`, ni Docker, ni servicios cloud
- 🔧 **Portable**: `git clone + npm install + npm run dev = funciona`
- 📁 **Persistencia real**: Datos guardados en `data/database.json`
- 🧹 **Menos dependencias**: Eliminar `@prisma/client`, `prisma`, `pg`

**Arquitectura:**

```
src/lib/local-data/
├── types.ts           ← Interfaces de datos (reemplazan schema.prisma)
├── utils.ts           ← load/save JSON, UUID, migraciones
├── index.ts           ← LocalData facade
└── stores/
    ├── user-profiles.ts
    ├── jobs.ts
    ├── cvs.ts
    ├── job-matches.ts
    ├── pipeline-runs.ts
    ├── email-digests.ts
    └── profile-changes.ts
```

**Cambios principales:**
1. Crear `src/lib/local-data/` con stores por entidad
2. Re-escribir `src/lib/prisma.ts` como wrapper de compatibilidad sobre `LocalData`
3. Refactorizar `src/lib/automation/job-history.ts`, `src/lib/cv/profileHistory.ts`, `src/lib/pdf/duplicateDetector.ts`, `src/lib/pdf/pdfIntegration.ts`, `src/matching/cvMatcher.ts`
4. Refactorizar `src/app/api/stats/route.ts` (el más crítico — usa SQL raw)
5. Eliminar `prisma/`, `prisma.config.ts`, `src/generated/prisma/`
6. Eliminar dependencias npm: `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg`
7. Tests unitarios para cada store

**Ver documento completo para detalle de cada archivo y orden de trabajo.**
---

## Issues Overview

| # | Title | State | Phase |
|---|-------|-------|-------|
| **10** | [REFACTOR] Almacenamiento local JSON | 🟢 **Open** | Phase 8 |
| **9** | [BACKEND] Integración Supabase | 🔵 **Closed** (reemplazado por #10) | Phase 6 |
| **8** | [FEATURE] Frontend UI Dashboard | 🔵 **Closed** ✅ | Phase 7 |
| **7** | [FEATURE] AI PDF profile extraction | 🔵 **Closed** ✅ | Phase 5 |
| **6** | [DEFERRED] process-cv pipeline | 🔵 **Closed** — absorbed | Phase 6 |

---

## Requirement Traceability

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| JOB-01 | Scrape LinkedIn | 1 | ✅ Complete |
| JOB-02 | Scrape Indeed | 1 | ✅ Complete |
| JOB-03 | Scrape Glassdoor | 1 | ✅ Complete |
| JOB-04 | User profile schema | 2 | ✅ Complete |
| JOB-05 | AI job matching | 2 | ✅ Complete |
| JOB-06 | Email integration (SMTP/Resend/Gmail) | 3 | ✅ Complete |
| JOB-07 | Email formatting (HTML + emojis + scores) | 3 | ✅ Complete |
| JOB-08 | GitHub Actions workflow | 4 | ✅ Complete |
| JOB-09 | Job history management | 4 | ✅ **Refactorizado en Fase 8** |
| PDF-01 | PDF upload and parsing | 5 | ✅ Complete |
| PDF-02 | Profile extraction from text | 5 | ✅ Complete |
| PDF-03 | Integration with matching | 5 | ✅ Complete |
| PDF-04 | Integration with email | 5 | ✅ Complete |
| PDF-05 | Duplicate detection | 5 | ✅ Complete |
| CV-01 | Store CVs with versioning | 6 | ✅ **Refactorizado en Fase 8** |
| CV-02 | Auto-extract skills from CV | 6 | ✅ Complete (in #7) |
| CV-03 | Update profile from CV data | 6 | ✅ Complete (in #7) |
| CV-04 | Use profile for job matching | 6 | ✅ Complete (in #7) |
| CV-05 | Track profile changes | 6 | ✅ **Refactorizado en Fase 8** |
| UI-01 | React frontend dashboard | 7 | ✅ **Complete** |

---

## Tech Stack Summary

| Layer | Technology | Status |
|-------|-----------|--------|
| Runtime | TypeScript (CommonJS) + tsx | ✅ |
| Scrapers | Python (Scrapling) + JSearch API | ✅ |
| AI | Gemini Flash + keyword fallback | ✅ |
| Scoring | Weighted (40/30/20/10) | ✅ |
| Email | SMTP · Resend · Gmail API | ✅ |
| CI/CD | GitHub Actions (weekly + push) | ✅ |
| Storage | Local JSON files (`data/database.json`) | ✅ **Refactorizado** |
| Frontend | Next.js · Tailwind CSS · Framer Motion · Recharts | ✅ **Complete** |

---

*Maintained by AI assistant — last updated 2026-05-15*
