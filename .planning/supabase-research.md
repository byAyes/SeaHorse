# Issue #9 — Integración de Base de Datos: Migración a Neon.tech

**Fecha:** 2026-05-15
**Estado:** ✅ **Completada — Migración a Neon.tech operativa**

---

## Decisión final: Neon.tech 🥇

**Razones:**

1. IPv4 incluido — funciona en Windows sin add-ons de $10/mes
2. Pooling automático — sin necesidad de configurar Supavisor/PgBouncer
3. Mismo stack: PostgreSQL + Prisma — migración trivial
4. No usamos Auth/Storage/Realtime de Supabase — no hay pérdida

---

## Conexión actual (Neon.tech)

```env
DATABASE_URL=postgresql://neondb_owner:[PASSWORD]@ep-morning-bread-aqerv5kb.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:[PASSWORD]@ep-morning-bread-aqerv5kb.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Host:** `ep-morning-bread-aqerv5kb.c-8.us-east-1.aws.neon.tech`
**Database:** `neondb`
**User:** `neondb_owner`
**SSL:** `sslmode=require`

---

## Stack final

```
PrismaClient 7.8.0 → @prisma/adapter-pg → pg.Pool → Neon.tech PostgreSQL
```

---

## Pruebas de verificación

| Prueba                                  |                 Resultado                 |
| --------------------------------------- | :---------------------------------------: |
| `pg.Pool` → `SELECT 1`                  |         ✅ Conexión IPv4 directa          |
| `npx prisma db push`                    |          ✅ Schema sincronizado           |
| `prisma.userProfile.findMany()`         |       ✅ Query real devuelve datos        |
| `prisma.job.findMany()` (tras pipeline) |          ✅ 61 jobs persistidos           |
| Pipeline completa (`npm run automate`)  | ✅ Scrape → Save → Email → Mark → Cleanup |

---

## Bugs encontrados y fixes

### Bug 1: Jobs nunca se persistían (legacy del mock)

La pipeline usaba el mock de Prisma que noopeaba todos los writes. Tras reemplazar por PrismaClient real, los jobs se enviaban por email pero nunca se guardaban en la DB.

**Fix:** `saveNewJobs()` en `src/lib/automation/job-history.ts` — inserta jobs con `createMany` + `skipDuplicates`, devuelve UUIDs de DB.

### Bug 2: `markJobsAsEmailed` usaba scraper IDs en vez de UUIDs

`saveNewJobs` omite el campo `id` para que Prisma genere UUIDs automáticos, pero `markJobsAsEmailed` seguía usando los IDs de los scrapers (ej: "indeed-12345"), que no coincidían con los UUIDs.

**Fix:** Pasar `savedIds` (los UUIDs de DB) a `markJobsAsEmailed` en vez de `newJobs.map(job => job.id)`.

### Bug 3: Sin limpieza de DB post-ejecución

`cleanupOldJobs(3)` con retención de 3 meses era demasiado laxo. La DB se llenaba sin limpieza efectiva.

**Fix:** `cleanupEmailedJobs(7)` + safety net `cleanupOldJobs(1)` — ejecutado en cada pipeline run.

---

## Pipeline flow final

```
Scrape → Filter by date → Filter new → saveNewJobs() → Match → Email → markJobsAsEmailed() → cleanupEmailedJobs(7) → cleanupOldJobs(1)
```

---

## Archivos modificados (todo el issue #9)

| Archivo                             | Cambio                                                          |        Commit        |
| ----------------------------------- | --------------------------------------------------------------- | :------------------: |
| `.env`                              | Supabase URLs → Neon URLs                                       |    🔒 gitignored     |
| `src/lib/prisma.ts`                 | Mock proxy → PrismaClient real con @prisma/adapter-pg + pg.Pool |      `4780f76`       |
| `src/lib/automation/job-history.ts` | saveNewJobs() + cleanupEmailedJobs()                            | `7b3084a` + `latest` |
| `src/automation/orchestrator.ts`    | Persist + mark with UUIDs + dual cleanup                        | `7b3084a` + `latest` |
| `.planning/supabase-research.md`    | Documentación actualizada                                       |       `latest`       |

---

## Historial de decisiones

| Fecha      | Decisión                                                             |
| ---------- | -------------------------------------------------------------------- |
| 2026-05-15 | Fase 1: Research completado (Supabase pooler, IPv4 workarounds)      |
| 2026-05-15 | Fase 2: Mock → PrismaClient real con Supabase directa ✅             |
| 2026-05-15 | **Migración a Neon.tech** — IPv4, pooling automático, $0             |
| 2026-05-15 | Fix persistencia: saveNewJobs + DB UUIDs en markJobsAsEmailed        |
| 2026-05-15 | Fix cleanup: cleanupEmailedJobs(7) + cleanupOldJobs(1) por ejecución |
