# Refactor: Migrar de Prisma + Supabase/Neon a Almacenamiento Local (JSON Files)

> **Issue:** Reemplazar toda dependencia de base de datos externa (Prisma + PostgreSQL en Supabase/Neon) por un sistema de archivos local usando JSON.
>
> **Motivación:** El pipeline debe funcionar **sin configuración de base de datos**. Basta con clonar el repo, instalar deps y correr. Sin Docker, sin servicios cloud, sin variables de entorno de DB.

---

## 📋 Resumen del Cambio

| Actual | Nuevo |
|--------|-------|
| Prisma ORM + PrismaClient (mock actual) | `LocalDataStore` — clase singleton que lee/escribe JSON |
| PostgreSQL en Supabase/Neon (deferred) | Archivos JSON en `data/` (`.gitignore`-do) |
| `prisma/schema.prisma` con 5 modelos | 5+ archivos JSON tipados con TypeScript interfaces |
| `DATABASE_URL` env var requerida | **0 config de DB** |
| `npx prisma generate`, `npx prisma db push` | **0 comandos de DB** |
| Mock PrismaClient retorna defaults vacíos | Implementación real que persiste datos localmente |

---

## 🗺️ Arquitectura Propuesta

```
src/
  lib/
    local-data/
      index.ts           ← LocalDataStore class (singleton, facade)
      types.ts           ← Interfaces de datos (reemplazan schema.prisma)
      stores/
        user-profiles.ts ← CRUD UserProfile en JSON
        jobs.ts          ← CRUD Job + búsqueda/filtros
        cvs.ts           ← CRUD CV
        job-matches.ts   ← CRUD JobMatch
        pipeline-runs.ts ← CRUD PipelineRun + estadísticas
        email-digests.ts ← CRUD EmailDigest
        profile-changes.ts ← CRUD ProfileChangeLog
      utils.ts           ← load/save JSON, file locking, migraciones
  types/
    local-data.ts        ← Tipos exportados para el resto del código
data/                    ← Directorio de datos (gitignored)
  user-profiles.json
  jobs.json
  cvs.json
  job-matches.json
  pipeline-runs.json
  email-digests.json
  profile-changes.json
```

---

## 🔄 Cambios por Archivo

### Fase 1: Crear el Sistema de Almacenamiento Local

#### 1. `src/lib/local-data/types.ts` — Definir interfaces de datos

Reemplazar el schema de Prisma con interfaces TypeScript planas:

```ts
export interface StoredUserProfile {
  id: string;
  name: string;
  email: string;
  skills: string[];
  jobTitles: string[];
  locations: string[];
  experienceLevel: string;
  languages: string[];
  interests: string[];
  salaryMin?: number;
  salaryMax?: number;
  aiProvider?: string;
  cvId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCV {
  id: string;
  fileName: string;
  filePath: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  status: string; // "pending" | "processing" | "completed" | "failed"
  extractedText?: string;
  profileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  source: string;
  sourceId?: string;
  remote?: boolean;
  jobType?: string;
  publishedAt?: string;
  expiresAt?: string;
  emailedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredJobMatch {
  id: string;
  jobId: string;
  profileId: string;
  score: number;
  skillScore: number;
  interestScore: number;
  locationScore: number;
  salaryScore: number;
  breakdown?: string;
  createdAt: string;
}

export interface StoredPipelineRun {
  id: string;
  status: string; // "running" | "completed" | "failed"
  profileId?: string;
  jobsFound: number;
  jobsMatched: number;
  emailSent: boolean;
  startedAt: string;
  completedAt?: string;
  error?: string;
  duration?: number;
}

export interface StoredEmailDigest {
  id: string;
  recipient: string;
  subject: string;
  provider: string;
  status: string; // "sent" | "failed"
  jobsIncluded: number;
  sentAt: string;
  error?: string;
}

export interface StoredProfileChange {
  id: string;
  profileId: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  changeType: string;
  createdAt: string;
}

export interface LocalDatabase {
  userProfiles: StoredUserProfile[];
  cvs: StoredCV[];
  jobs: StoredJob[];
  jobMatches: StoredJobMatch[];
  pipelineRuns: StoredPipelineRun[];
  emailDigests: StoredEmailDigest[];
  profileChanges: StoredProfileChange[];
}
```

#### 2. `src/lib/local-data/utils.ts` — Utilidades de archivo

- `loadDatabase()` — Lee `data/database.json` (o archivos separados) y parsea JSON
- `saveDatabase(data)` — Escribe el JSON atómicamente (write to temp, rename)
- `generateId()` — UUID v4 para IDs
- `ensureDataDir()` — Crea `data/` si no existe
- Incluir migración automática: si un archivo no existe, se crea con array vacío

#### 3. `src/lib/local-data/stores/*.ts` — Stores individuales

Cada store exporta funciones que operan sobre su colección:

**`user-profiles.ts`:**
- `getAllProfiles(): StoredUserProfile[]`
- `getProfileById(id: string): StoredUserProfile | undefined`
- `createProfile(data: Partial<StoredUserProfile>): StoredUserProfile`
- `updateProfile(id: string, data: Partial<StoredUserProfile>): StoredUserProfile`
- `deleteProfile(id: string): void`
- `findProfileByEmail(email: string): StoredUserProfile | undefined`

**`jobs.ts`:**
- `getAllJobs(): StoredJob[]`
- `getJobById(id: string): StoredJob | undefined`
- `createJob(data: Partial<StoredJob>): StoredJob`
- `createJobs(jobs: Partial<StoredJob>[]): StoredJob[]` —批量创建
- `updateJob(id: string, data: Partial<StoredJob>): StoredJob`
- `deleteOldJobs(before: string): number` — cleanup por fecha
- `getJobsBySource(source: string): StoredJob[]`
- `getRecentJobs(days: number): StoredJob[]`
- `getJobStats(): { total: number; bySource: Record<string, number>; recent: number }`
- `markJobsAsEmailed(ids: string[]): void`

**`cvs.ts`:**
- `getAllCVs(): StoredCV[]`
- `getCVById(id: string): StoredCV | undefined`
- `createCV(data: Partial<StoredCV>): StoredCV`
- `updateCV(id: string, data: Partial<StoredCV>): StoredCV`
- `getPendingCVs(): StoredCV[]`
- `deleteOldCVs(before: string): number`
- `findDuplicate(fileName: string, fileSize: number): StoredCV | undefined`

**`job-matches.ts`:**
- `getMatchesByProfile(profileId: string): StoredJobMatch[]`
- `createMatch(data: Partial<StoredJobMatch>): StoredJobMatch`
- `createMatches(matches: Partial<StoredJobMatch>[]): StoredJobMatch[]`
- `getMatchStats(profileId: string): { total: number; avgScore: number; bestScore: number }`

**`pipeline-runs.ts`:**
- `getAllRuns(): StoredPipelineRun[]`
- `getRunById(id: string): StoredPipelineRun | undefined`
- `createRun(data: Partial<StoredPipelineRun>): StoredPipelineRun`
- `updateRun(id: string, data: Partial<StoredPipelineRun>): StoredPipelineRun`
- `getLatestRun(): StoredPipelineRun | undefined`
- `getRunStats(): { total: number; succeeded: number; failed: number }`

**`email-digests.ts`:**
- `getAllDigests(): StoredEmailDigest[]`
- `createDigest(data: Partial<StoredEmailDigest>): StoredEmailDigest`
- `getRecentDigests(days: number): StoredEmailDigest[]`

**`profile-changes.ts`:**
- `getChangesByProfile(profileId: string): StoredProfileChange[]`
- `logChange(data: Partial<StoredProfileChange>): StoredProfileChange`
- `getAllChanges(): StoredProfileChange[]`

#### 4. `src/lib/local-data/index.ts` — Facade principal

```ts
import * as UserProfiles from './stores/user-profiles';
import * as Jobs from './stores/jobs';
import * as CVs from './stores/cvs';
import * as JobMatches from './stores/job-matches';
import * as PipelineRuns from './stores/pipeline-runs';
import * as EmailDigests from './stores/email-digests';
import * as ProfileChanges from './stores/profile-changes';

export const LocalData = {
  userProfiles: UserProfiles,
  jobs: Jobs,
  cvs: CVs,
  jobMatches: JobMatches,
  pipelineRuns: PipelineRuns,
  emailDigests: EmailDigests,
  profileChanges: ProfileChanges,
};
```

#### 5. `src/types/local-data.ts` — Re-exportar tipos

```ts
export type {
  StoredUserProfile,
  StoredCV,
  StoredJob,
  StoredJobMatch,
  StoredPipelineRun,
  StoredEmailDigest,
  StoredProfileChange,
  LocalDatabase,
} from '../lib/local-data/types';
```

---

### Fase 2: Reemplazar `src/lib/prisma.ts`

#### 6. `src/lib/prisma.ts` — Reemplazar mock con LocalDataStore

**Antes:** Mock de PrismaClient que retorna arrays vacíos y promesas resueltas.

**Después:** Wrapper de compatibilidad que implementa la misma interfaz de Prisma pero usando `LocalData` internamente.

```ts
// src/lib/prisma.ts — Nueva implementación
import { LocalData } from './local-data';

// Objeto que imita la API de Prisma para compatibilidad backward
export const prisma = {
  userProfile: {
    findMany: (args?: any) => { /* mapear a LocalData.userProfiles */ },
    findUnique: (args: any) => { /* ... */ },
    findFirst: (args: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    update: (args: any) => { /* ... */ },
    delete: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
  },
  cV: {
    findMany: (args?: any) => { /* ... */ },
    findUnique: (args: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    update: (args: any) => { /* ... */ },
    delete: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
  },
  job: {
    findMany: (args?: any) => { /* ... */ },
    findUnique: (args: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    createMany: (args: any) => { /* ... */ },
    update: (args: any) => { /* ... */ },
    delete: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
  },
  jobMatch: {
    findMany: (args?: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    createMany: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
    aggregate: (args: any) => { /* ... */ },
  },
  pipelineRun: {
    findMany: (args?: any) => { /* ... */ },
    findFirst: (args: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    update: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
  },
  emailDigest: {
    findMany: (args?: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
    count: (args?: any) => { /* ... */ },
  },
  profileChangeLog: {
    findMany: (args?: any) => { /* ... */ },
    create: (args: any) => { /* ... */ },
  },
  $queryRaw: (query: TemplateStringsArray, ...values: any[]) => {
    // Para stats que usan raw SQL, reemplazar con lógica JS
    return Promise.resolve([]);
  },
  $disconnect: () => Promise.resolve(),
};
```

> **IMPORTANTE:** Cada store debe cargar el archivo JSON al inicio (lazy load) y re-escribirlo completo en cada mutación. Para evitar race conditions, usar un lock simple en memoria (promise chain).

---

### Fase 3: Actualizar Scripts

#### 7. `scripts/check-profile.ts`
- **Cambio mínimo:** `prisma.userProfile.findMany()` → sigue funcionando si el wrapper es compatible
- **Opción refactor:** Usar `LocalData.userProfiles.getAllProfiles()` directamente

#### 8. `scripts/cleanup-old-cvs.ts`
- `prisma.cV.findMany()` y `prisma.cV.delete()` → compatible con wrapper
- O usar `LocalData.cvs.deleteOldCVs(before)` directamente

#### 9. `scripts/scrape-jobs.ts`
- `prisma.userProfile.findMany()` → compatible

#### 10. `scripts/auto-update-profiles.ts`
- `prisma.cV.findMany()`, `prisma.userProfile.update()`, `prisma.cV.update()` → compatible

#### 11. `scripts/process-cv-uploads.ts`
- `prisma.cV.findMany()`, `prisma.cV.update()` → compatible

#### 12. `scripts/match-jobs.ts`
- `prisma.userProfile.findMany()`, `prisma.job.findMany()` → compatible

#### 13. `scripts/test-matching.ts`
- `prisma.userProfile.findUnique()`, `prisma.userProfile.create()`, `prisma.job.findMany()` → compatible

#### 14. `scripts/send-email-digest.ts`
- `prisma.emailDigest.findMany()` → compatible

#### 15. `scripts/run-profile-pipeline.ts`
- **No toca prisma directamente** (usa `orchestrator.ts`) → sin cambios

---

### Fase 4: Actualizar API Routes

#### 16. `src/app/api/stats/route.ts`
- **Crítico:** Usa `prisma.$queryRaw` para consultas SQL raw → reemplazar con `LocalData` calls
- Reemplazar:
  - `prisma.job.count(...)` → `LocalData.jobs.getAllJobs().length` con filtros
  - `prisma.$queryRaw<...>` → lógica JS que calcule stats directamente
  - `prisma.emailDigest.findMany(...)` → `LocalData.emailDigests.getAllDigests()`
  - `prisma.pipelineRun.count/findFirst` → `LocalData.pipelineRuns.getRunStats/getLatestRun()`

#### 17. `src/app/api/pipeline/run/route.ts`
- `prisma.pipelineRun.create()` → compatible
- `prisma.job.createMany()` → compatible
- `prisma.jobMatch.createMany()` → compatible

#### 18. `src/app/api/match-jobs/route.ts`
- `prisma.jobMatch.create()` → compatible

#### 19. `src/app/api/profile/history/route.ts`
- `prisma.profileChangeLog.findMany()` → compatible

#### 20. `src/app/api/cv/upload/route.ts`
- `prisma.cV.create()` → compatible

#### 21. `src/app/api/cv/process/route.ts`
- `prisma.cV.update()` → compatible

#### 22. `src/app/api/cv/update-profile/route.ts`
- `prisma.userProfile.upsert()` → compatible (implementar upsert en wrapper)

#### 23. `src/app/api/pdf/upload/route.ts`
- `prisma.cV.create()` → compatible

#### 24. `src/app/api/pdf/match/route.ts`
- `prisma.jobMatch.create()` → compatible

---

### Fase 5: Actualizar Librerías de Automatización

#### 25. `src/lib/automation/job-history.ts`
- Reemplazar `prisma.job.findMany/createMany/update` con `LocalData.jobs.*`
- Funciones a refactorizar:
  - `saveNewJobs(jobs, profileId)` → `LocalData.jobs.createJobs()`
  - `getRecentJobs(days)` → `LocalData.jobs.getRecentJobs(days)`
  - `getJobStats()` → `LocalData.jobs.getJobStats()`
  - `markJobsAsEmailed(jobIds)` → `LocalData.jobs.markJobsAsEmailed(jobIds)`
  - `cleanupOldJobs()` → `LocalData.jobs.deleteOldJobs(before)`

#### 26. `src/lib/cv/profileHistory.ts`
- Reemplazar `prisma.profileChangeLog.create/findMany` con `LocalData.profileChanges.*`
- `logProfileChange(profileId, field, oldValue, newValue, changeType)` → `LocalData.profileChanges.logChange()`
- `getProfileHistory(profileId, days)` → `LocalData.profileChanges.getChangesByProfile()`

#### 27. `src/lib/pdf/duplicateDetector.ts`
- Reemplazar `prisma.cV.findFirst()` con `LocalData.cvs.findDuplicate()`

#### 28. `src/lib/pdf/pdfIntegration.ts`
- Reemplazar `prisma.cV.create/update/findUnique` con `LocalData.cvs.*`

---

### Fase 6: Matching

#### 29. `src/matching/cvMatcher.ts`
- Reemplazar `prisma.userProfile.findUnique/upsert`, `prisma.job.findMany`, `prisma.jobMatch.createMany` con `LocalData.*`

---

### Fase 7: Limpieza

#### 30. Eliminar archivos y dependencias no necesarias

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | 🗑️ Eliminar |
| `prisma.config.ts` | 🗑️ Eliminar |
| `prisma/migrations/` | 🗑️ Eliminar directorio |
| `src/generated/prisma/` | 🗑️ Eliminar directorio |
| `@prisma/client` | `npm uninstall @prisma/client` |
| `prisma` | `npm uninstall prisma` |
| `@prisma/adapter-pg` | `npm uninstall @prisma/adapter-pg` |
| `pg` | `npm uninstall pg` |
| `.env` | 🗑️ Eliminar línea `DATABASE_URL` |
| `.env.example` | 🗑️ Eliminar sección de DB |

#### 31. Agregar `data/` a `.gitignore`

```
# Local data storage
data/
*.json
```

---

## 🧪 Plan de Testing

Cada store debe tener tests unitarios:

| Test | Descripción |
|------|-------------|
| `tests/local-data/user-profiles.test.ts` | CRUD completo, búsqueda por email |
| `tests/local-data/jobs.test.ts` | CRUD, bulk create, filtros por source/fecha, stats, cleanup |
| `tests/local-data/cvs.test.ts` | CRUD, detección de duplicados, cleanup |
| `tests/local-data/pipeline-runs.test.ts` | CRUD, stats, latest |
| `tests/local-data/stats-route.test.ts` | Que los stats devuelvan los mismos datos que antes |
| `tests/local-data/compat.test.ts` | Que el wrapper de prisma retorne los mismos tipos que mock anterior |

---

## 📦 Dependencias a Remover

```bash
npm uninstall @prisma/client prisma @prisma/adapter-pg pg
```

**Dependencias a agregar:** Ninguna. Todo es vanilla Node.js (`fs`, `path`, `crypto` para UUIDs).

---

## 🚨 Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Race condition en escritura JSON | Implementar lock en memoria (cola de promesas) |
| Archivo JSON corrupto | Backup automático antes de escribir; validación al cargar |
| Pérdida de datos si crash en media escritura | Write a temp file → `fs.rename()` (atómico en mismo filesystem) |
| Gran volumen de jobs (10k+) | Implementar paginación en memoria; dividir en chunks si es necesario |
| API routes existentes esperan API de Prisma | Usar wrapper de compatibilidad primero, migrar gradualmente |
| `$queryRaw` en stats route | Reemplazar con lógica JS equivalente que calcule stats desde los arrays |

---

## 📐 Formato de Datos

### `data/database.json`

Archivo único que contiene todo (simplifica backup y consistencia):

```json
{
  "version": 1,
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "userProfiles": [],
  "cvs": [],
  "jobs": [],
  "jobMatches": [],
  "pipelineRuns": [],
  "emailDigests": [],
  "profileChanges": []
}
```

**Alternativa:** Archivos separados por entidad para mejor paralelismo:

```
data/
  _meta.json          ← versión + timestamp de última escritura
  user-profiles.json
  cvs.json
  jobs.json
  job-matches.json
  pipeline-runs.json
  email-digests.json
  profile-changes.json
```

> **Recomendación:** Empezar con archivo único (`database.json`) por simplicidad. Migrar a archivos separados solo si el rendimiento es un problema (ej. +10k registros).

---

## ✅ Criterios de Aceptación

1. `git clone && npm install && npm run dev` funciona sin configurar DB
2. `npx tsx scripts/run-profile-pipeline.ts` funciona y persiste datos localmente
3. Dashboard UI muestra datos reales guardados en JSON
4. Los datos persisten entre reinicios del servidor
5. `data/` está en `.gitignore` (no se suben datos al repo)
6. Scripts CLI funcionan sin cambios en la interfaz de usuario
7. 0 dependencias de base de datos en `package.json`
8. Todos los tests unitarios pasan

---

## 📊 Orden Sugerido de Implementación

```
Fase 1:   src/lib/local-data/types.ts          ← Día 1
Fase 1:   src/lib/local-data/utils.ts           ← Día 1
Fase 1:   src/lib/local-data/stores/*.ts        ← Día 1-2
Fase 1:   src/lib/local-data/index.ts           ← Día 2
Fase 2:   src/lib/prisma.ts (wrapper compat)    ← Día 2
Fase 3:   Scripts CLI (solo probar)             ← Día 2
Fase 4:   src/app/api/stats/route.ts            ← Día 3 (el más riesgoso)
Fase 5:   job-history.ts, profileHistory.ts     ← Día 3
Fase 6:   cvMatcher.ts                          ← Día 3
Fase 7:   Tests unitarios                       ← Día 3-4
Fase 7:   Limpieza (eliminar prisma, deps)      ← Día 4
Fase 7:   Documentación                         ← Día 4
```

---

## 🔗 Archivos Afectados (Lista Completa)

### Crear (nuevos)
- `src/lib/local-data/types.ts`
- `src/lib/local-data/utils.ts`
- `src/lib/local-data/index.ts`
- `src/lib/local-data/stores/user-profiles.ts`
- `src/lib/local-data/stores/jobs.ts`
- `src/lib/local-data/stores/cvs.ts`
- `src/lib/local-data/stores/job-matches.ts`
- `src/lib/local-data/stores/pipeline-runs.ts`
- `src/lib/local-data/stores/email-digests.ts`
- `src/lib/local-data/stores/profile-changes.ts`
- `src/types/local-data.ts`

### Modificar
- `src/lib/prisma.ts` (reescribir wrapper de compatibilidad)
- `src/lib/automation/job-history.ts`
- `src/lib/cv/profileHistory.ts`
- `src/lib/pdf/duplicateDetector.ts`
- `src/lib/pdf/pdfIntegration.ts`
- `src/matching/cvMatcher.ts`
- `src/app/api/stats/route.ts`
- `.gitignore` (agregar `data/`)

### Posible modificación (solo si el wrapper no es suficiente)
- `src/app/api/pipeline/run/route.ts`
- `src/app/api/match-jobs/route.ts`
- `src/app/api/profile/history/route.ts`
- `src/app/api/cv/upload/route.ts`
- `src/app/api/cv/process/route.ts`
- `src/app/api/cv/update-profile/route.ts`
- `src/app/api/pdf/upload/route.ts`
- `src/app/api/pdf/match/route.ts`

### Sin cambios (el wrapper de compatibilidad los cubre)
- `scripts/check-profile.ts`
- `scripts/cleanup-old-cvs.ts`
- `scripts/scrape-jobs.ts`
- `scripts/auto-update-profiles.ts`
- `scripts/process-cv-uploads.ts`
- `scripts/match-jobs.ts`
- `scripts/test-matching.ts`
- `scripts/send-email-digest.ts`
- `scripts/run-profile-pipeline.ts`

### Eliminar
- `prisma/schema.prisma`
- `prisma.config.ts`
- `prisma/migrations/` (directorio completo)
- `src/generated/prisma/` (directorio completo)

### Dependencias npm a remover
- `@prisma/client`
- `prisma`
- `@prisma/adapter-pg`
- `pg`

---

*Documento creado como plan de refactor para migrar a almacenamiento 100% local.*
