---
name: "🤖 Auto-Apply — Postulación automatizada con IA"
about: "Feature request: aplicar automáticamente a ofertas laborales usando IA, con CV personalizado por oferta"
title: "feat: Auto-Apply — Postulación automatizada con IA"
labels: ["enhancement", "feature", "auto-apply"]
assignees: []
---

# 🤖 Auto-Apply: Postulación automatizada con IA

## Resumen

Extender el pipeline actual (scrape → match → email) para que **pueda postularse automáticamente** a las ofertas mejor rankeadas. El sistema debe ser capaz de:

1. Generar un **CV y cover letter personalizados** para cada oferta laboral
2. **Enviar la postulación** mediante browser automation o APIs directas
3. **Trackear el estado** de cada postulación (enviada, rechazada, entrevista, etc.)

---

## 🎯 Objetivos

| Objetivo | Prioridad |
|---|---|
| Postulación 1-click desde el dashboard | 🔴 Alta |
| CV adaptado por oferta con IA | 🔴 Alta |
| Cover letter generada por IA | 🔴 Alta |
| Auto-apply en múltiples portales | 🟡 Media |
| Tracking de estado de postulaciones | 🟡 Media |
| Rate limiting para evitar baneos | 🔴 Alta |
| Manejo de CAPTCHAs / bloqueos | 🟡 Media |

---

## 🏗️ Arquitectura Propuesta

### Flujo Completo

```
[Pipeline actual: scrape → match → score]
            │
            ▼
[Filtro: top-N jobs (score > umbral)]
            │
            ▼
[Generar CV personalizado (IA)]
            │
            ▼
[Generar Cover Letter (IA)]
            │
            ▼
[Browser Automation / API]
            │
            ▼
[Tracking: estado de postulación]
```

### Módulos Nuevos

```
src/
├── auto-apply/
│   ├── index.ts                  # Orquestador principal
│   ├── types.ts                  # Tipos (Application, ApplicationStatus, etc.)
│   ├── cv-generator.ts           # Generación de CV personalizado por IA
│   ├── cover-letter-generator.ts # Generación de cover letter por IA
│   ├── browser/
│   │   ├── index.ts              # Browser pool + navegación
│   │   ├── linkedin.ts           # Postulante en LinkedIn
│   │   ├── indeed.ts             # Postulante en Indeed
│   │   ├── glassdoor.ts          # Postulante en Glassdoor
│   │   └── computrabajo.ts       # Postulante en Computrabajo
│   ├── tracker.ts                # Tracking de estado de postulaciones
│   ├── rate-limiter.ts           # Rate limiting por portal
│   └── strategies/
│       ├── types.ts              # Estrategias de aplicación
│       ├── apply-with-cv.ts      # CV upload + cover letter
│       ├── apply-external.ts     # Redirección a portal externo
│       └── apply-easy.ts         # Postulación 1-click (LinkedIn Easy Apply, etc.)
└── app/(main)/
    └── applications/
        ├── page.tsx              # Dashboard de postulaciones
        └── [id]/
            └── page.tsx          # Detalle de postulación individual
```

---

## 📄 Sistema de Generación de CV Personalizado

### Estrategia

En lugar de modificar el PDF original del usuario, el sistema debe **generar un CV nuevo en formato HTML** y convertirlo a PDF. Esto permite:

- Control total sobre el diseño y contenido
- Adaptar skills, experiencia y resumen por oferta
- Mantener el CV original intacto

### Prompt de Generación de CV

```typescript
const CV_GENERATION_PROMPT = `You are a professional resume writer. Generate a tailored CV
for the following job application.

JOB DESCRIPTION:
{jobDescription}

CANDIDATE PROFILE:
{extractedProfile}

INSTRUCTIONS:
1. Highlight the skills and experience most relevant to this specific job
2. Reword bullet points to use keywords from the job description
3. Keep the same factual information — DO NOT fabricate experience or skills
4. Prioritize sections in order: Summary → Skills → Experience → Education
5. Use strong action verbs and quantify achievements where possible
6. Keep the CV to 1-2 pages
7. Return the CV in HTML format styled for A4 printing

Return ONLY a valid JSON object:
{
  "summary": "2-3 sentence summary tailored to this job",
  "skills": ["prioritized skills, most relevant first"],
  "experience": [
    {
      "jobTitle": "string",
      "company": "string",
      "duration": "string",
      "description": "string (tailored bullet points)"
    }
  ],
  "education": [...],
  "certifications": [...]
}`;
```

### Cover Letter Generation

```typescript
const COVER_LETTER_PROMPT = `You are a professional cover letter writer. Generate a compelling
cover letter for the following job application.

JOB: {jobTitle} at {company}
JOB DESCRIPTION: {jobDescription}

CANDIDATE:
{summary}

RULES:
- 3-4 paragraphs maximum
- Address the hiring manager directly
- Mention the company by name and show knowledge of their work
- Connect candidate's experience to specific job requirements
- Include a call to action
- Professional but warm tone
- No placeholders or brackets`;
```

### HTML → PDF Conversion

```typescript
// Opciones de conversión a evaluar:
// 1. puppeteer/playwright → print to PDF (más control, más peso)
// 2. jsPDF o pdfmake (liviano, menos control visual)
// 3. API externa (DocRaptor, PDFShift, etc.)
// 4. @react-pdf/renderer (si ya se usa React)

import { chromium } from 'playwright';

async function htmlToPDF(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
  await browser.close();
  return Buffer.from(pdf);
}
```

---

## 🌐 Browser Automation por Portal

### Estrategia General

Cada portal tiene un módulo dedicado que implementa una interfaz común:

```typescript
interface PortalApplier {
  /** Nombre del portal */
  portalName: string;
  /** URL del portal */
  baseUrl: string;
  /** Login si es necesario */
  login(browser: Browser, credentials: Credentials): Promise<void>;
  /** Aplicar a una oferta */
  apply(browser: Browser, job: MatchedJob, cv: Buffer, coverLetter: string): Promise<ApplicationResult>;
  /** Verificar si requiere autenticación */
  requiresAuth: boolean;
  /** Límite de aplicaciones por hora */
  rateLimit: number;
}
```

### Portal-Specific Notes

| Portal | Estrategia | Autenticación | Complejidad |
|---|---|---|---|
| **LinkedIn Easy Apply** | Modal embedding — rellenar formulario, adjuntar CV | Sesión guardada | 🟡 Media |
| **LinkedIn (redirect)** | Redirección externa — marcar como "applied" | No necesita | 🟢 Baja |
| **Indeed** | Aplicación directa con CV upload | Sesión guardada | 🟡 Media |
| **Computrabajo** | Postulación con CV + cover letter | Sesión guardada | 🟡 Media |
| **Glassdoor** | Redirección a portal externo | No necesita | 🟢 Baja |

### Credential Management

```typescript
interface PortalCredentials {
  linkedin?: { email: string; password: string };
  indeed?: { email: string; password: string };
  computrabajo?: { email: string; password: string };
}
```

**Almacenamiento:** Usar el mismo sistema `local-data/` existente, con encriptación opcional (crypto.createCipheriv). **NUNCA** guardar contraseñas en texto plano sin encriptación.

```typescript
interface AutoApplyConfig {
  enabled: boolean;
  maxApplicationsPerDay: number;
  minMatchScore: number;  // Solo aplicar a jobs con score >= este umbral
  portals: ('linkedin' | 'indeed' | 'computrabajo' | 'glassdoor')[];
  credentials: PortalCredentials;
  strategy: 'manual-review' | 'semi-automatic' | 'fully-automatic';
  browserHeadless: boolean;
  simulateOnly: boolean;  // Para testing: no enviar realmente
}
```

---

## 📊 Tracking de Postulaciones

### Tipo de datos

```typescript
interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  portal: string;
  matchScore: number;
  status: ApplicationStatus;
  appliedAt?: string;
  coverLetter?: string;
  cvVersionId?: string;
  notes?: string;
  followUpDate?: string;
  response?: {
    status: 'rejected' | 'interview' | 'offer' | 'pending';
    receivedAt: string;
    message?: string;
  }[];
}

type ApplicationStatus =
  | 'pending-review'     // En cola para revisión humana
  | 'approved'           // Aprobado para aplicar
  | 'applied'            // Postulación enviada
  | 'error'              // Error al aplicar
  | 'rejected'           // Rechazado por el empleador
  | 'interview'          // Entrevista agendada
  | 'offer'              // Oferta recibida
  | 'withdrawn';         // Retirada por el usuario
```

### Almacenamiento

Usar el sistema existente `src/lib/local-data/`:

```typescript
// src/auto-apply/tracker.ts
import { LocalData } from '../lib/local-data';

interface ApplicationStore {
  applications: Application[];
  config: AutoApplyConfig;
  stats: {
    totalApplied: number;
    todayApplied: number;
    lastApplicationDate: string;
    interviews: number;
    offers: number;
  };
}

export class ApplicationTracker extends LocalData<ApplicationStore> {
  constructor() {
    super('applications', {
      applications: [],
      config: defaultConfig,
      stats: defaultStats,
    });
  }
}
```

---

## ⚠️ Consideraciones de Seguridad y Rate Limiting

### Rate Limiting

```typescript
const RATE_LIMITS = {
  linkedin: { maxPerHour: 30, maxPerDay: 100, cooldownMs: 120000 },
  indeed: { maxPerHour: 50, maxPerDay: 150, cooldownMs: 60000 },
  computrabajo: { maxPerHour: 40, maxPerDay: 120, cooldownMs: 90000 },
  glassdoor: { maxPerHour: 20, maxPerDay: 60, cooldownMs: 180000 },
};
```

### CAPTCHA Handling

- **Primera línea:** Detección y pausa — si se detecta CAPTCHA, esperar y reintentar
- **Segunda línea:** Notificar al usuario para que resuelva manualmente
- **Tercera línea:** Usar proxies rotativos para evitar triggers de seguridad
- **NO** implementar resolución automática de CAPTCHAs (ilegal en muchos TOS)

### Almacenamiento Seguro de Credenciales

```typescript
import { createCipheriv, randomBytes, createDecipheriv } from 'crypto';

const ENCRYPTION_KEY = process.env.AUTO_APPLY_ENCRYPTION_KEY;

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY!, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}
```

---

## 🧪 Plan de Implementación

### Sprint 1 — Fundación (semana 1-2)

- [ ] Definir tipos (`Application`, `ApplicationStatus`, `AutoApplyConfig`, `PortalCredentials`)
- [ ] Implementar `ApplicationTracker` con almacenamiento local
- [ ] Crear `cv-generator.ts` con prompt de generación de CV
- [ ] Crear `cover-letter-generator.ts` con prompt de cover letter
- [ ] Implementar `htmlToPDF()` usando Playwright
- [ ] Agregar UI de configuración de auto-apply en Settings (`/settings`)

### Sprint 2 — Browser Automation (semana 3-4)

- [ ] Implementar browser pool reutilizable
- [ ] Módulo LinkedIn (Easy Apply + login)
- [ ] Módulo Indeed (aplicación directa)
- [ ] Módulo Computrabajo (postulación con CV)
- [ ] Módulo Glassdoor (aplicación directa)
- [ ] Rate limiter global por portal
- [ ] Manejo de errores + reintentos

### Sprint 3 — Dashboard y Tracking (semana 5-6)

- [ ] Página `/applications` con tabla de postulaciones
- [ ] Página `/applications/[id]` con detalle individual
- [ ] Estado de tracking (applied, rejected, interview, offer)
- [ ] Sistema de follow-up automático (email de seguimiento)
- [ ] Notificaciones en dashboard de cambios de estado
- [ ] Estadísticas: aplicación rate, interview rate, offer rate

### Sprint 4 — Polaco y Seguridad (semana 7-8)

- [ ] Encriptación de credenciales
- [ ] Modo `simulateOnly` para testing
- [ ] Rate limiting adaptativo
- [ ] Detección de CAPTCHA
- [ ] Proxy rotativo
- [ ] Pruebas E2E con Playwright
- [ ] Documentación de seguridad

---

## 🔬 Investigación de Referencia

Plataformas similares y sus enfoques:

| Plataforma | Enfoque | CV Personalizado | Apertura |
|---|---|---|---|
| **Simplify.jobs** | Browser extension + dashboard | ❌ Mismo CV | ✅ Open |
| **LazyApply** | Browser automation con Puppeteer | ❌ Mismo CV | ❌ Closed |
| **Vincere** | API integration con ATS | ✅ Sí (manual) | ❌ Enterprise |
| **Pythagora** | AI agent con browser control | ✅ Sí (IA) | ✅ Open source |

**Lecciones aprendidas:**

1. **CV personalizado es el diferenciador clave** — la mayoría de herramientas usan el mismo CV para todo. Adaptarlo por oferta con IA mejora drásticamente la tasa de éxito.
2. **Browser automation es frágil** — los selectores CSS cambian. Usar selectores semánticos y tener fallbacks.
3. **Rate limiting es obligatorio** — los portales bloquean IPs si se envía demasiadas postulaciones rápido.
4. **El usuario debe poder revisar antes de enviar** — especialmente al principio, modo "semi-automatic" genera más confianza.
5. **LinkedIn Easy Apply es el canal más valioso** — es el más usado y tiene la menor fricción.

---

## 🔗 Dependencias

- `playwright` (ya instalado para Jina Reader) — para browser automation
- `@react-pdf/renderer` (opcional) — alternativa para generar PDFs
- `crypto` (built-in Node.js) — para encriptación de credenciales

---

## 📋 Issues Relacionadas

- Issues de extracción de perfil (necesario para CV personalizado)
- Issues de matching scores (umbral de auto-apply depende de score)
- Issues de scraping (necesario para conseguir ofertas a aplicar)

---

## 💬 Preguntas Abiertas

1. ¿Debería el auto-apply ser un modo opcional (opt-in) o parte del pipeline por defecto?
2. ¿Soporte inicial solo para LinkedIn Easy Apply o múltiples portales desde el inicio?
3. ¿Manejo de sesiones: guardar cookies para reuso o login cada vez?
4. ¿CV en PDF o DOCX? La mayoría de portales aceptan PDF.
