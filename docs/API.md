# Seahorse REST API Reference

> **Base URL:** `http://localhost:3000` (Next.js dev server) or your deployed URL
> **Auth:** All endpoints (except `/api/health`) support optional Bearer token via `ADMIN_API_TOKEN`

---

## Table of Contents

1. [Healthcheck](#1-healthcheck)
2. [Pipeline](#2-pipeline)
3. [Jobs & Matching](#3-jobs--matching)
4. [CV / Profile](#4-cv--profile)
5. [Email](#5-email)
6. [PDF Upload](#6-pdf-upload)
7. [Stats & Dashboard](#7-stats--dashboard)
8. [Configuration](#8-configuration)
9. [Error Codes](#9-error-codes)
10. [Scripts de Automatización](#10-scripts-de-automatización)
    1. [setup.ps1](#101-setupps1--instalación-automática-windows)
    2. [run.ps1](#102-runps1--runner-interactivo-windows)
    3. [setup.sh](#103-setupsh--instalación-automática-linuxmacos)
    4. [run.sh](#104-runsh--runner-interactivo-linuxmacos)
    5. [Flujo típico](#105-flujo-típico)

---

## 1. Healthcheck

Monitor system status — uptime, environment config, Jina Reader connectivity, scraper status.

### `GET /api/health`

**Auth:** None

**Response `200 OK`:**

```json
{
  "status": "ok",
  "timestamp": "2025-05-19T14:30:00.000Z",
  "uptime": {
    "seconds": 3600,
    "human": "1h 0s"
  },
  "server": {
    "nodeVersion": "v22.14.0",
    "platform": "win32",
    "env": "development"
  },
  "environment": [
    {
      "group": "Email",
      "set": ["EMAIL_PROVIDER", "SMTP_HOST", "GMAIL_RECIPIENT"],
      "missing": ["SMTP_USER", "EMAIL_CC"]
    },
    {
      "group": "API Keys",
      "set": [],
      "missing": ["JSEARCH_API_KEY", "GEMINI_API_KEY"]
    },
    {
      "group": "Jina Reader",
      "set": ["JINA_READER_BASE_URL"],
      "missing": []
    }
  ],
  "jinaReader": {
    "configured": true,
    "reachable": true
  },
  "pythonScrapers": {
    "configFound": true,
    "enabledCount": 5,
    "scrapers": ["computrabajo", "glassdoor", "indeed", "linkedin", "linkedin-scraping"]
  },
  "scrapers": {
    "runner": "available"
  }
}
```

**Response `503 Service Unavailable`:** Returned when ScraperRunner fails to import.

---

## 2. Pipeline

Trigger and monitor pipeline executions.

### `POST /api/pipeline/run`

Start a new pipeline execution (scrape → match → cleanup). Runs asynchronously — returns immediately with a `runId`.

**Auth:** Bearer token (optional)

**Rate limited:** 5 requests/minute per IP

**Request body:**

```json
{
  "profile": {
    "skills": ["Python", "TypeScript", "React"],
    "jobTitles": ["Software Engineer", "Full Stack Developer"],
    "locations": ["Remote", "Bogotá"],
    "experienceLevel": "senior"
  }
}
```

| Field     | Type   | Required | Description                                  |
| --------- | ------ | :------: | -------------------------------------------- |
| `profile` | object |    No    | Optional user profile for AI matching scores |

**Response `201 Created`:**

```json
{
  "runId": "run_1747612800000_a1b2c3d4",
  "status": "running"
}
```

### `GET /api/pipeline/run?runId=xxx`

Poll for pipeline status and results.

**Auth:** Bearer token (optional)

**Query parameters:**

| Parameter | Type   | Required | Description                        |
| --------- | ------ | :------: | ---------------------------------- |
| `runId`   | string |   Yes    | Run ID from POST /api/pipeline/run |

**Response `200 OK` (running):**

```json
{
  "id": "run_1747612800000_a1b2c3d4",
  "status": "running",
  "logs": [
    "[14:30:00] Pipeline iniciado...",
    "[14:30:01] Buscando: \"software engineer\" (máx. 10 por fuente)",
    "[14:30:15] Scraping completado: 31 jobs encontrados"
  ],
  "result": null,
  "error": null,
  "startedAt": null,
  "completedAt": null
}
```

**Response `200 OK` (completed):**

```json
{
  "id": "run_1747612800000_a1b2c3d4",
  "status": "completed",
  "logs": [
    "[14:30:00] Pipeline iniciado...",
    "[14:30:15] Scraping completado: 31 jobs encontrados",
    "[14:30:16] ✅ Pipeline completado exitosamente"
  ],
  "result": {
    "scraped": 31,
    "matched": 31,
    "saved": 31,
    "cleaned": 0,
    "errors": [],
    "scraperStats": [
      { "name": "jsearch", "jobs": 10, "errors": 0, "duration": 3000 },
      { "name": "computrabajo", "jobs": 10, "errors": 0, "duration": 5000 },
      { "name": "jinareader-linkedin", "jobs": 1, "errors": 0, "duration": 8000 }
    ],
    "matches": [
      {
        "job": {
          "id": "job_xxx",
          "title": "Senior Software Engineer",
          "company": "Google",
          "location": "Mountain View, CA",
          "salary": 180000,
          "url": "https://...",
          "skills": ["Python", "Go", "Kubernetes"]
        },
        "score": {
          "overall": 82,
          "skillMatch": 85,
          "interestMatch": 90,
          "locationMatch": 60,
          "salaryMatch": 100,
          "matchedSkills": ["Python", "TypeScript"]
        }
      }
    ]
  },
  "error": null,
  "startedAt": "2025-05-19T14:30:00.000Z",
  "completedAt": "2025-05-19T14:30:20.000Z"
}
```

**Response `404 Not Found`:** `{ "error": "Run no encontrado" }`

---

## 3. Jobs & Matching

### `GET /api/match-jobs`

Retrieve jobs scored against a user profile.

**Auth:** Bearer token (optional)

**Query parameters:**

| Parameter   | Type   | Required | Default | Description                         |
| ----------- | ------ | :------: | :-----: | ----------------------------------- |
| `userId`    | string |   Yes    |    —    | User ID to get profile for          |
| `threshold` | number |    No    |   70    | Minimum match score (0-100)         |
| `limit`     | number |    No    |   100   | Maximum number of results to return |

**Response `200 OK`:**

```json
{
  "matches": [
    {
      "job": {
        "id": "jr-a1b2c3d4",
        "title": "Senior Software Engineer",
        "company": "Google",
        "location": "Mountain View, CA",
        "description": "We're looking for...",
        "url": "https://careers.google.com/...",
        "salary": 180000,
        "postedAt": "2025-05-15T00:00:00.000Z",
        "scrapedAt": "2025-05-19T14:30:00.000Z",
        "skills": ["Python", "Go", "Kubernetes"],
        "category": "Engineering"
      },
      "score": {
        "overall": 82,
        "skillMatch": 85,
        "interestMatch": 90,
        "locationMatch": 60,
        "salaryMatch": 100,
        "matchedSkills": ["Python", "TypeScript"]
      }
    }
  ],
  "total": 42,
  "threshold": 70,
  "userId": "default-user"
}
```

**Error responses:** `400` (missing userId), `404` (profile not found)

### Scoring breakdown

| Score field     | Weight | Description                            |
| --------------- | :----: | -------------------------------------- |
| `skillMatch`    |  40%   | Levenshtein fuzzy match vs CV skills   |
| `interestMatch` |  30%   | Job title/industry vs career interests |
| `locationMatch` |  20%   | City, remote, hybrid, partial matches  |
| `salaryMatch`   |  10%   | Range overlap, over-max penalty        |
| `overall`       |  100%  | Weighted sum of all factors            |

---

## 4. CV / Profile

### `POST /api/cv/upload`

Upload a CV PDF with versioning.

**Auth:** Bearer token (optional)

**Rate limited:** 10 requests/minute per IP

**Request:** `multipart/form-data`

| Field    | Type | Required | Description              |
| -------- | ---- | :------: | ------------------------ |
| `file`   | File |   Yes    | PDF file (<10MB)         |
| `userId` | text |   Yes    | User ID for the CV owner |

**Response `200 OK`:**

```json
{
  "success": true,
  "cvId": "cv-1747612800000-a1b2c3d4",
  "version": 1,
  "fileUrl": "/cvs/user123/1747612800000-resume.pdf"
}
```

**Error responses:** `400` (missing fields, wrong file type, >10MB), `429` (rate limit)

### `GET /api/cv/versions`

Get all CV versions for a user.

**Query parameters:**

| Parameter | Type   | Required | Description             |
| --------- | ------ | :------: | ----------------------- |
| `userId`  | string |   Yes    | User ID for the CV list |

**Response `200 OK`:**

```json
{
  "versions": [
    {
      "version": 1,
      "uploadedAt": "2025-05-19T14:30:00.000Z",
      "fileName": "resume.pdf",
      "fileSize": 245760,
      "status": "processed",
      "skillsCount": 15
    }
  ],
  "total": 1
}
```

### `POST /api/cv/process`

Process a CV — extract skills, experience, education.

**Auth:** Bearer token (optional)

**Request body:**

```json
{
  "cvId": "cv-1747612800000-a1b2c3d4",
  "provider": "gemini",
  "apiKey": "your-gemini-api-key"
}
```

| Field      | Type   | Required | Description                           |
| ---------- | ------ | :------: | ------------------------------------- |
| `cvId`     | string |   Yes    | CV ID from POST /api/cv/upload        |
| `provider` | string |    No    | AI provider for extraction (`gemini`) |
| `apiKey`   | string |    No    | API key for the AI provider           |

**Response `200 OK`:**

```json
{
  "success": true,
  "skills": ["Python", "TypeScript", "React"],
  "experience": 3,
  "education": 2,
  "rawText": "Full text of the CV...",
  "profile": {
    "skills": ["Python", "TypeScript"],
    "jobTitles": ["Software Engineer"],
    "locations": ["Remote"],
    "experienceLevel": "senior"
  }
}
```

### `GET /api/profile/extract?userId=xxx`

Get user profile for dashboard settings.

**Auth:** Bearer token (optional)

**Response `200 OK`:**

```json
{
  "id": "default-user",
  "userId": "default-user",
  "skills": [],
  "interests": [],
  "location": null,
  "remoteOnly": false,
  "minSalary": null,
  "maxSalary": null,
  "experienceLevel": null,
  "createdAt": "2025-05-19T14:30:00.000Z",
  "weightings": {
    "skills": 0.4,
    "interests": 0.3,
    "location": 0.2,
    "salary": 0.1
  }
}
```

### `POST /api/profile/extract`

Extract profile from a PDF or text. Accepts three content types:

#### Option 1: Multipart form (PDF file)

```
Content-Type: multipart/form-data
```

| Field  | Type | Required | Description      |
| ------ | ---- | :------: | ---------------- |
| `file` | File |   Yes    | PDF file (<10MB) |

#### Option 2: JSON with text

```json
{
  "text": "Experienced software engineer with 5 years in Python, TypeScript..."
}
```

#### Option 3: Binary PDF

```
Content-Type: application/pdf
<binary PDF data>
```

**Response `200 OK`:**

```json
{
  "success": true,
  "profile": {
    "skills": ["Python", "TypeScript", "React", "Node.js"],
    "jobTitles": ["Software Engineer", "Full Stack Developer"],
    "locations": ["Remote", "Bogotá, Colombia"],
    "experienceLevel": "senior",
    "industries": ["Technology", "Fintech"],
    "languages": ["Spanish (Native)", "English (Fluent)"],
    "summary": "Software engineer with 8+ years...",
    "salaryRange": {
      "min": 80000,
      "max": 150000,
      "currency": "USD"
    }
  }
}
```

---

## 5. Email

### `POST /api/email/send`

Send an email via the configured provider.

**Auth:** Bearer token (optional)

**Rate limited:** 5 requests/minute per IP

**Request body:**

```json
{
  "to": "user@example.com",
  "subject": "Weekly Job Digest",
  "body": "<html><body><h1>Your Jobs</h1>...</body></html>"
}
```

| Field     | Type   | Required | Description        |
| --------- | ------ | :------: | ------------------ |
| `to`      | string |   Yes    | Recipient email    |
| `subject` | string |   Yes    | Email subject line |
| `body`    | string |   Yes    | HTML or plain text |

**Response `200 OK`:**

```json
{
  "success": true,
  "messageId": "<abc123@example.com>"
}
```

### `GET /api/email/send`

Send a test email to the configured `GMAIL_RECIPIENT`.

**Auth:** Bearer token (optional)

**Response `200 OK`:**

```json
{
  "success": true,
  "messageId": "<abc123@example.com>",
  "message": "Test email sent to recipient@example.com"
}
```

---

## 6. PDF Upload

### `POST /api/pdf/upload`

Upload a PDF containing job listings — extract jobs, check duplicates, save non-duplicates.

**Auth:** Bearer token (optional)

**Request:** `multipart/form-data` or `application/pdf` (binary)

**Response `200 OK`:**

```json
{
  "success": true,
  "jobsAdded": 5,
  "duplicates": 2,
  "total": 7
}
```

---

## 7. Stats & Dashboard

### `GET /api/stats`

Dashboard statistics — job counts, trends, top skills, recent matches, pipeline status.

**Auth:** Bearer token (optional)

**Response `200 OK`:**

```json
{
  "totalJobs": 150,
  "totalJobsToday": 12,
  "totalMatches": 100,
  "totalProfiles": 1,
  "pipelinesRun": 8,
  "jobTrend": 25,
  "jobsByDay": [
    { "date": "2025-05-13", "count": 15 },
    { "date": "2025-05-14", "count": 22 }
  ],
  "topSkills": [
    { "skill": "Python", "count": 45 },
    { "skill": "TypeScript", "count": 38 }
  ],
  "recentMatches": [
    {
      "job": {
        "id": "jr-xxx",
        "title": "Senior Software Engineer",
        "company": "Google",
        "location": "Mountain View, CA",
        "skills": ["Python", "Go"]
      },
      "score": {
        "overall": 0,
        "skillMatch": 0,
        "interestMatch": 0,
        "locationMatch": 0,
        "salaryMatch": 0,
        "matchedSkills": [],
        "explanation": "Visita la página de resultados para ver scores detallados."
      }
    }
  ],
  "lastPipelineRun": {
    "id": "run_xxx",
    "status": "completed",
    "startedAt": "2025-05-19T14:30:00.000Z",
    "completedAt": "2025-05-19T14:30:20.000Z",
    "scraped": 31,
    "matched": 31,
    "saved": 31,
    "error": null
  }
}
```

**Response `500`:** Returns zeros/empty arrays (graceful degradation).

---

## 8. Configuration

### `GET /api/config/keys`

List which API keys are configured (without exposing values).

**Auth:** Bearer token (optional)

**Response `200 OK`:**

```json
{
  "configured": {
    "jsearch": true,
    "gemini": false,
    "openrouter": false,
    "nim": false
  },
  "activeProvider": "gemini"
}
```

### `POST /api/config/keys`

Save API keys to the server config store. Only provided keys are updated — existing keys are preserved.

**Auth:** Bearer token (optional)

**Request body** (all fields optional):

```json
{
  "jsearchApiKey": "your-key",
  "geminiApiKey": "your-key",
  "openrouterApiKey": "your-key",
  "nimApiKey": "your-key"
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "saved": ["jsearchApiKey", "geminiApiKey"]
}
```

---

## 9. Error Codes

All endpoints return consistent HTTP status codes:

| Status | Code                   | Description                            |
| :----: | ---------------------- | -------------------------------------- |
|  200   | OK                     | Request succeeded                      |
|  201   | Created                | Resource created (pipeline run)        |
|  400   | Bad Request            | Missing or invalid parameters          |
|  401   | Unauthorized           | Invalid or missing Bearer token        |
|  404   | Not Found              | Resource not found (CV, run, profile)  |
|  415   | Unsupported Media Type | Wrong Content-Type for profile extract |
|  422   | Unprocessable Entity   | Profile extraction failed              |
|  429   | Too Many Requests      | Rate limit exceeded                    |
|  500   | Internal Server Error  | Unexpected server error                |
|  503   | Service Unavailable    | ScraperRunner unavailable              |

### Rate limiting

Rate-limited endpoints return 429 with these headers:

```
Retry-After: 60
X-RateLimit-Remaining: 0
```

### Authentication

When `ADMIN_API_TOKEN` is set in the environment, all endpoints (except `/api/health`) require:

```
Authorization: Bearer <your-token>
```

When `ADMIN_API_TOKEN` is not set, authentication is skipped (development mode).

---

## 10. Scripts de Automatización

Scripts copy-paste para instalación y ejecución del proyecto sin configuración manual.

| Script      | Plataforma  | Propósito                                  |
| ----------- | ----------- | ------------------------------------------ |
| `setup.ps1` | Windows     | Instalación completa (clone + deps + .env) |
| `run.ps1`   | Windows     | Runner interactivo (4 modos)               |
| `setup.sh`  | Linux/macOS | Instalación completa (clone + deps + .env) |
| `run.sh`    | Linux/macOS | Runner interactivo (4 modos, bash)         |

---

### 10.1 setup.ps1 — Instalación automática (Windows)

Clona el repositorio, instala dependencias (npm + pip + Playwright/Patchright), crea `.env` desde `.env.example` y lo abre en Notepad para configuración.

**Uso:**

```powershell
# Opción A — Una línea (descarga y ejecuta)
irm https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.ps1 | iex

# Opción B — Descargar y ejecutar (recomendado)
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.ps1" -OutFile "setup.ps1"
.\setup.ps1
```

**Parámetros:**

| Parámetro  | Tipo   | Default         | Descripción                      |
| ---------- | ------ | --------------- | -------------------------------- |
| `RepoPath` | string | `$PWD\SeaHorse` | Ruta donde clonar el repositorio |

**Pasos que ejecuta:**

|  #  | Paso                     | Descripción                                       |
| :-: | ------------------------ | ------------------------------------------------- |
|  1  | Verificar prerrequisitos | Node.js 20+, Python 3.12+, Git, Docker (opcional) |
|  2  | Clonar / actualizar repo | `git clone` o `git pull --ff-only` si ya existe   |
|  3  | Crear `.env`             | Copia `.env.example` → `.env`, abre en Notepad    |
|  4  | `npm install`            | `--legacy-peer-deps` para compatibilidad          |
|  5  | `pip install`            | Dependencias Python (`scrapers/requirements.txt`) |
|  6  | Playwright + Patchright  | Instala navegadores Chromium                      |
|  7  | Jina Reader (Docker)     | Pregunta si levantar el contenedor (opcional)     |

**Comportamiento:**

- Si el repo ya existe en `RepoPath`, hace `git pull --ff-only` en lugar de clonar
- Si `.env` ya existe, lo conserva sin sobrescribir
- Docker es opcional — si no está instalado, se salta el paso 7
- Todos los comandos nativos verifican `$LASTEXITCODE` y fallan con mensaje claro

---

### 10.2 run.ps1 — Runner interactivo (Windows)

[⇧ Volver al índice](#table-of-contents)

Ejecuta el pipeline de scraping + matching + email, o inicia el dashboard. Valida `.env`, detecta CVs en `data/`, y presenta un menú interactivo.

**Uso:**

```powershell
# Menú interactivo
.\scripts\run.ps1

# Modo directo
.\scripts\run.ps1 -CvPath "C:\Users\Juan\Downloads\CV.pdf"
.\scripts\run.ps1 -Dashboard
.\scripts\run.ps1 -Basic
```

**Parámetros:**

| Parámetro    | Tipo   | Descripción                                              |
| ------------ | ------ | -------------------------------------------------------- |
| `-CvPath`    | string | Ruta al archivo CV/PDF para extracción de perfil         |
| `-Dashboard` | switch | Inicia el servidor de desarrollo Next.js                 |
| `-Basic`     | switch | Pipeline básico (scrape → match → email, sin extracción) |

**Modos interactivos:**

| Opción | Modo              | Descripción                                                |
| :----: | ----------------- | ---------------------------------------------------------- |
|   1    | Pipeline completo | Extrae perfil desde CV → scrape → match → email (~60-90s)  |
|   2    | Pipeline básico   | scrape → match → email (sin extracción de perfil)          |
|   3    | Dashboard UI      | Servidor Next.js en `http://localhost:3000`                |
|   4    | Solo Jina Reader  | Test headless Chrome fallback contra una fuente específica |

**Validación:**

- Verifica que `.env` existe y contiene `JSEARCH_API_KEY`, `GEMINI_API_KEY`, `GMAIL_RECIPIENT`
- Valores tipo `your_key_here` se detectan como no configurados
- Si faltan variables, ofrece abrir `.env` en Notepad
- Detección automática de la carpeta del proyecto (dentro de `scripts/` o standalone)

---

### 10.3 setup.sh — Instalación automática (Linux/macOS)

[⇧ Volver al índice](#table-of-contents)

Equivalente en bash de `setup.ps1`. Clona el repositorio, instala dependencias (npm + pip + Playwright/Patchright), crea `.env` desde `.env.example` y lo abre en el editor.

**Uso:**

```bash
# Opción A — Una línea (descarga y ejecuta)
bash <(curl -s https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.sh)

# Opción B — Descargar y ejecutar (recomendado)
curl -O https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.sh
chmod +x setup.sh
./setup.sh
```

**Parámetros:**

| Parámetro   | Tipo   | Default         | Descripción                      |
| ----------- | ------ | --------------- | -------------------------------- |
| `REPO_PATH` | string | `$PWD/SeaHorse` | Ruta donde clonar el repositorio |

**Pasos que ejecuta:**

|  #  | Paso                     | Descripción                                          |
| :-: | ------------------------ | ---------------------------------------------------- |
|  1  | Verificar prerrequisitos | Node.js 20+, Python 3.12+, Git, Docker (opcional)    |
|  2  | Clonar / actualizar repo | `git clone` o `git pull --ff-only` si ya existe      |
|  3  | Crear `.env`             | Copia `.env.example` → `.env`, abre en nano/vim/code |
|  4  | `npm install`            | `--legacy-peer-deps` para compatibilidad             |
|  5  | `pip install`            | Dependencias Python (`scrapers/requirements.txt`)    |
|  6  | Playwright + Patchright  | Instala navegadores Chromium                         |
|  7  | Jina Reader (Docker)     | Pregunta si levantar el contenedor (opcional)        |

**Características:**

- ANSI colors con helpers `step()` / `ok()` / `warn()` / `fail()` / `info()`
- `run_cmd()`: wrapper que ejecuta comandos y reporta errores sin cortar el script
- Detección inteligente de `pip` (`python3 -m pip` → `python -m pip` → `pip3` → `pip`)
- Comparación de versiones Python pura con bash (sin dependencia de `bc`)
- Editor fallback: `nano` → `vim` → `code`
- Seguridad: `set -euo pipefail`, validación con `bash -n`

---

### 10.4 run.sh — Runner interactivo (Linux/macOS)

[⇧ Volver al índice](#table-of-contents)

Equivalente en bash de `run.ps1` con la misma funcionalidad e interfaz interactiva.

**Uso:**

```bash
# Menú interactivo
./scripts/run.sh

# Modo directo
./scripts/run.sh --cv ~/Downloads/CV.pdf
./scripts/run.sh --dashboard
./scripts/run.sh --basic
./scripts/run.sh --help
```

**Argumentos:**

| Argumento     | Descripción                                              |
| ------------- | -------------------------------------------------------- |
| `--cv RUTA`   | Ruta al archivo CV/PDF para extracción de perfil         |
| `--dashboard` | Inicia el servidor de desarrollo Next.js                 |
| `--basic`     | Pipeline básico (scrape → match → email, sin extracción) |
| `--help`      | Muestra la ayuda                                         |

**Características:**

- ANSI colors con helpers `step()` / `ok()` / `warn()` / `fail()` / `info()`
- `get_env_var()`: parsea `.env`, salta comentarios y placeholders (`your_.*_here`, `your_email`)
- Detección de `data/*.pdf` con `find -print0` (soporta espacios en nombres de archivo)
- Editor fallback: `nano` → `vim` → `code`
- Seguridad: `set -euo pipefail`, validación de código con `bash -n`

---

### 10.5 Flujo típico

**Windows (PowerShell):**

```powershell
# 1. Instalación (una vez)
irm https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.ps1 | iex

# 2. Editar .env con tus API keys (se abre automáticamente)

# 3. Ejecutar pipeline
.\scripts\run.ps1 --cv "C:\Users\Juan\Downloads\CV.pdf"
```

**Linux/macOS (Bash):**

```bash
# 1. Instalación (una vez)
bash <(curl -s https://raw.githubusercontent.com/byAyes/SeaHorse/main/scripts/setup.sh)

# 2. Editar .env con tus API keys (se abre automáticamente)

# 3. Ejecutar pipeline
./scripts/run.sh --cv ~/Downloads/CV.pdf
```

**Flujo detallado (Linux/macOS, paso a paso):**

```bash
# 1. Clonar manualmente
git clone https://github.com/byAyes/SeaHorse.git
cd SeaHorse

# 2. Copiar y editar .env
cp .env.example .env
nano .env

# 3. Instalar dependencias
npm install
pip install -r scrapers/requirements.txt
playwright install chromium
patchright install chromium

# 4. Ejecutar pipeline
./scripts/run.sh --cv ~/Downloads/CV.pdf
```

---

## Quick Examples

```bash
# Healthcheck
curl http://localhost:3000/api/health

# Start pipeline
curl -X POST http://localhost:3000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"profile":{"skills":["Python"],"jobTitles":["Engineer"]}}'

# Poll pipeline status
curl http://localhost:3000/api/pipeline/run?runId=run_xxx

# Get stats
curl http://localhost:3000/api/stats

# Extract profile from CV
curl -X POST http://localhost:3000/api/profile/extract \
  -F "file=@resume.pdf"

# Get match scores
curl "http://localhost:3000/api/match-jobs?userId=default&threshold=70"

# Send email
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Test","body":"Hello"}'

# Check API keys
curl http://localhost:3000/api/config/keys

# Check system health
curl http://localhost:3000/api/health | jq '.status'
```
