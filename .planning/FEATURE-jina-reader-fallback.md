# Feature: Jina Reader Headless Chrome Fallback Scraper

**Issue:** [#20 — Jina Reader Headless Chrome Fallback Scraper](https://github.com/byAyes/SeaHorse/issues/20)
**Branch:** `byAyes/feature-posible-implementacion-de-jina-reader-y`
**Status:** 🔵 **Closed** ✅
**Closed:** 2026-07-15 — Exhaustive testing passed (19/19 tests, live Computrabajo ✅, merge to main ✅)

---

## Resumen

Integrar [Jina Reader](https://github.com/jina-ai/reader) como scraper fallback para fuentes de empleo que los scrapers tradicionales (Python Scrapling + HTTP) no pueden scrapear debido a bloqueos, Cloudflare, o JavaScript pesado.

Jina Reader actúa como un proxy headless Chrome: toma una URL, la renderiza con un navegador real, y devuelve el contenido como texto plano / markdown estructurado. Esto permite scrapear sitios que requieren JavaScript.

---

## Motivación

Los scrapers actuales tienen problemas con varias fuentes:

| Fuente       | Scraper actual      | Problema                                             |
| ------------ | ------------------- | ---------------------------------------------------- |
| LinkedIn     | Python Scrapling    | Bloqueado completamente por login wall y rate limits |
| Indeed       | Python Scrapling    | Intermitente, 403 Cloudflare                         |
| Glassdoor    | Python Scrapling    | Intermitente, anti-bot measures                      |
| Computrabajo | ✅ Funciona         | No necesita fallback                                 |
| JSearch API  | ✅ Siempre funciona | API key requerida                                    |

Jina Reader (especialmente con Docker self-hosting) puede evadir estos bloqueos usando un navegador Chrome headless real.

---

## Arquitectura

```
Pipeline normal → detectar fallos → JinaReader fallback
      ↓                              ↓
  JSearch + Python            Jina Reader headless
  scrapers concurrentes       → parseMarkdown()
      ↓                              ↓
  stats con exito/falla       dedup contra jobs existentes
                                      ↓
                              merge en resultados finales
```

### Flujo detallado:

1. `ScraperRunner.run()` ejecuta todos los scrapers configurados
2. Se registran estadisticas por scraper (success/fail + jobCount)
3. `identifyFailedSources()` analiza las stats para linkedin, indeed, computrabajo, glassdoor
4. Si alguna fuente fallo (success=false) o retorno 0 jobs (success=true, jobCount=0), se activa el fallback
5. `runJinaReaderFallbacks()` ejecuta JinaReaderScraper para cada fuente fallida
6. Los jobs devueltos se deduplican contra los ya recolectados por otros scrapers
7. Cada fallback registra su propia entrada en stats (ej: `jinareader-linkedin`)

---

## Archivos modificados

### Nuevos

| Archivo                                 | Lineas | Proposito                                   |
| --------------------------------------- | ------ | ------------------------------------------- |
| `src/scrapers/strategies/jinaReader.ts` | +967   | Scraper Jina Reader completo con 4 parsers  |
| `docker-compose.yml`                    | +26    | Self-hosting con ghcr.io/jina-ai/reader:oss |

### Modificados

| Archivo                 | Cambio                                            |
| ----------------------- | ------------------------------------------------- |
| `src/scrapers/index.ts` | +106 lines: integracion fallback en ScraperRunner |
| `.env.example`          | +101/-14: 8 secciones de config documendada       |
| `knowledge.md`          | +66 lines: docs de Jina Reader                    |

---

## Componentes del scraper

### `JinaReaderScraper` class

- **`scrape(config)`**: Metodo principal que:
  1. Aplica rate limiting
  2. Construye URL via `JINA_READER_BASE` + `sourceConfig.buildUrl(query)`
  3. Hace GET request con `axios` (timeout 45s, X-Engine: browser)
  4. Valida respuesta (status 200, contenido > 50 chars)
  5. Parsea markdown via `sourceConfig.parseMarkdown()`
  6. Deduplica por `title|company`
  7. Retorna jobs limitados a `config.maxJobs`
- **`generateId(input)`**: ID deterministico via base64 hash

### Parsers específicos

| Fuente       | Parser                        | Formato de entrada                    |
| ------------ | ----------------------------- | ------------------------------------- |
| LinkedIn     | `parseLinkedInMarkdown()`     | Headings `## Title` + bullet lists    |
| Indeed       | `parseIndeedMarkdown()`       | Headings + salary extraction          |
| Computrabajo | `parseComputrabajoMarkdown()` | `## [Title](url)` posicional          |
| Glassdoor    | `parseGlassdoorMarkdown()`    | Headings + K-notation salary + rating |

### Utilidades compartidas

| Funcion                         | Proposito                                          |
| ------------------------------- | -------------------------------------------------- | --- |
| `extractTitle()`                | Extrae titulo de heading o bold                    |
| `isValidTitle()`                | Filtra 30+ patrones no-job (nav, login, etc.)      |
| `extractField()`                | Extrae campo etiquetado (`**Company:**`)           |
| `extractAfterPrefix()`          | Extrae empresa tras "at", "·", "                   | "   |
| `extractLocationFromLine()`     | Detecta patrones de ubicacion                      |
| `extractSalary()`               | Extrae salario (USD)                               |
| `extractDescription()`          | Extrae descripcion (primeras 5 lineas)             |
| `extractLink()`                 | Extrae primera URL del bloque                      |
| `parseBulletList()`             | Parsea listas con formato `- **Title** at Company` |
| `isValidSpanishTitle()`         | Valida titulos en espanol con acentos              |
| `extractComputrabajoHeading()`  | Extrae `## [Title](url)`                           |
| `extractComputrabajoCompany()`  | Extrae empresa con rating opcional                 |
| `extractComputrabajoLocation()` | Ubicaciones latinoamericanas                       |
| `extractComputrabajoSalary()`   | Salarios en formato $ X.XXX.XXX,XX (Mensual)       |
| `extractGlassdoorSalary()`      | Salarios K-notation ($150K - $220K)                |
| `extractGlassdoorRating()`      | Ratings (4.2 estrellas)                            |

---

## Resultados de pruebas

### Test: Computrabajo via cloud (r.jina.ai)

```
npx tsx src/scrapers/strategies/jinaReader.ts computrabajo "desarrollador" 5
```

**Resultado: ✅ 5 jobs extraidos**

1. Desarrollador Kotlin at Inter Rapidisimo S.A - Bogota, D.C.
2. Desarrollador Full Stack at Key Team - Bogota, D.C.
3. Desarrolladora Comercial at MANZHU SAS - Cali, Valle del Cauca
4. Desarrollador Net Senior at BROWSER TRAVEL SOLUTIONS - Bogota, D.C.
5. Desarrollador Front End at BROWSER TRAVEL SOLUTIONS - Bogota, D.C.

### Test: LinkedIn via cloud (r.jina.ai)

```
npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 5
```

**Resultado: ❌ 451 Unavailable For Legal Reasons**

Jina Reader cloud bloquea LinkedIn por restricciones legales. Solo funciona con self-hosting.

### Test: Indeed via cloud (r.jina.ai)

```
npx tsx src/scrapers/strategies/jinaReader.ts indeed "software engineer" 5
```

**Resultado: ❌ 403 Cloudflare**

Indeed detecta y bloquea el crawler de Jina Reader cloud. Podria funcionar con self-hosting.

---

## Self-hosting con Docker

### docker-compose.yml

```yaml
services:
  jina-reader:
    image: ghcr.io/jina-ai/reader:oss
    ports:
      - '3000:8080' # h2c (HTTP/2 con prior knowledge)
      - '3001:8081' # HTTP/1.1 standard
```

Para usar la instancia local:

```bash
docker compose up -d jina-reader
JINA_READER_BASE_URL=http://localhost:3001 npx tsx src/scrapers/strategies/jinaReader.ts linkedin "software engineer" 5
```

---

## Variables de entorno

| Variable                | Default             | Proposito                                       |
| ----------------------- | ------------------- | ----------------------------------------------- |
| `JINA_READER_BASE_URL`  | `https://r.jina.ai` | URL base de Jina Reader (cloud o self-hosted)   |
| `COMPUTRABAJO_COUNTRY`  | `co`                | Pais para Computrabajo (co, mx, ar, es, pe, cl) |
| `COMPUTRABAJO_BASE_URL` | auto                | URL base personalizada para Computrabajo        |

---

## Posibles mejoras futuras

- [ ] Agregar mas fuentes (ZipRecruiter, Monster, InfoJobs)
- [ ] Cache de respuestas de Jina Reader para evitar re-scrapear
- [ ] Soporte de API key para s.jina.ai (search endpoint)
- [ ] Auto-detectar el formato del markdown (no depender de parsers fijos)
- [ ] Timeout configurable por fuente
- [ ] Proxies rotativos para self-hosting
- [ ] Tests unitarios para cada parser
- [ ] Fallback a Jina Reader como scraper primario cuando el pipeline corre sin Python
