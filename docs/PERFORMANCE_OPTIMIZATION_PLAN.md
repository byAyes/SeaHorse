# Plan de Optimización de Rendimiento — Seahorse Dashboard

**Fecha:** 2025-05-25
**Branch:** `fix/rendimiento-oom-dashboard`
**Issue:** [#33 — Rendimiento extremadamente lento y OOM](https://github.com/byAyes/SeaHorse/issues/33)
**PRs relacionados:** [#32](https://github.com/byAyes/SeaHorse/pull/32)

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Línea Base Actual (Lighthouse)](#2-línea-base-actual-lighthouse)
3. [Lo Ya Corregido — Fase 1](#3-lo-ya-corregido--fase-1)
4. [Análisis de Causas Raíz Pendientes](#4-análisis-de-causas-raíz-pendientes)
5. [Plan de Acción Detallado](#5-plan-de-acción-detallado)
6. [Presupuesto de Rendimiento (Performance Budget)](#6-presupuesto-de-rendimiento-performance-budget)
7. [Métrica de Éxito](#7-métrica-de-éxito)
8. [Apéndice: Bundle Analysis](#8-apéndice-bundle-analysis)

---

## 1. Resumen Ejecutivo

La aplicación Seahorse sufre de **bajo rendimiento en el frontend** que se manifiesta como:

- LCP de **9.4s** (objetivo: < 2.5s)
- Total Blocking Time de **2,280ms** (objetivo: < 200ms)
- Performance Score de **42/100** en Lighthouse (dev mode)

**Nota importante:** La auditoría se ejecutó en modo `npm run dev` (sin minificación, tree-shaking ni compresión). En producción (`next start`), los números serán mejores, pero la arquitectura actual tiene problemas estructurales que afectarán incluso en prod.

### Impacto en usuarios

| Síntoma | Severidad | Frecuencia |
|---------|-----------|------------|
| Página no carga (OOM) | 🔴 Crítica | Ocasional (StrictMode + rAF leak) |
| LCP lento (>8s) | 🟡 Alta | Siempre en carga inicial |
| TBT alto (>2s) | 🟡 Alta | En cada interacción |
| Bundle grande (>1.4MB) | 🟡 Media | Siempre |
| Re-renders innecesarios | 🟢 Baja | Constante |

---

## 2. Línea Base Actual (Lighthouse)

**Modo:** `npm run dev` — sin optimizaciones de producción.
**URL evaluada:** `http://localhost:3000/dashboard`

### Scores

| Categoría | Score | Evaluación |
|-----------|-------|------------|
| **Performance** | **42/100** | ❌ Necesita mejora |
| Accessibility | 95/100 | ✅ Excelente |
| Best Practices | 96/100 | ✅ Excelente |
| SEO | 100/100 | ✅ Excelente |

### Core Web Vitals

| Métrica | Valor | Score | Objetivo | Diagnóstico |
|---------|-------|-------|----------|-------------|
| **LCP** | **9.4s** | 0.00 | < 2.5s | ❌ Bundle JS grande sin code-split |
| **TBT** | **2,280ms** | 0.05 | < 200ms | ❌ framer-motion + recharts bloquean main thread |
| **Speed Index** | **5.3s** | 0.58 | < 3.0s | ⚠️ Renderizado bloqueado por JS |
| **FCP** | **1.2s** | 0.99 | < 1.8s | ✅ Bueno (servidor responde rápido) |
| **CLS** | **0.019** | 1.00 | < 0.05 | ✅ Excelente (sin saltos de layout) |
| **TTI** | **10.1s** | 0.26 | < 3.8s | ❌ Totalmente bloqueado por JS pesado |

### Desglose de Tiempo del Hilo Principal

| Actividad | Tiempo | Porcentaje |
|-----------|--------|------------|
| Script Evaluation | 3,359ms | 48% |
| Script Parsing | 822ms | 12% |
| Style & Layout | 648ms | 9% |
| Other | 2,171ms | 31% |

### Transfer Size por Recurso (sin comprimir, dev)

| Recurso | Tamaño | Tipo |
|---------|--------|------|
| next/dist/compiled/next-server | 213KB | DevTools runtime |
| react-dom (client) | 180KB | Core |
| motion-dom (framer-motion) | 93KB | Animation |
| recharts | 51KB | Charts (ya code-splitted ✅) |
| Otros chunks | ~893KB | Resto |
| **Total** | **~1.43MB** | |

> En producción con Gzip/Brotli, esto se reduciría a ~350-400KB aproximadamente.

---

## 3. Lo Ya Corregido — Fase 1

Estos cambios ya están aplicados en la rama `fix/rendimiento-oom-dashboard` y mergeados o en PR.

### Fix 1: 🔴 `cancelAnimationFrame` en AnimatedNumber
**Archivo:** `src/components/dashboard/stats-grid.tsx`

**Problema:** El componente `AnimatedNumber` usaba `requestAnimationFrame` recursivo sin cancelar el frame anterior en el cleanup del `useEffect`. Con React StrictMode (activo en dev), el componente se monta dos veces — el primer loop rAF nunca se detenía, creando un **leak de memoria exponencial**.

**Solución:**
```tsx
useEffect(() => {
  // ...early returns...
  let rafId: number;
  const tick = () => { /* ... */ };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId); // <-- cleanup
}, [value, delay]);
```

### Fix 2: 🟡 Stats API — Caché + Límite + Bugfix
**Archivo:** `src/app/api/stats/route.ts`

**Problemas:**
- No había caché: cada request reprocesaba **todos** los jobs desde el archivo JSON
- No había límite: cargaba el dataset completo en memoria sin `take`
- **Bug crítico:** `jobCol` no estaba definido (faltaba `new LocalCollection('jobs')`) — causaba crash silencioso y OOM

**Solución:**
```tsx
// Caché en memoria con TTL 30s
const CACHE_TTL = 30_000;
let statsCache: { data: StatsResponse; expiry: number } | null = null;

if (statsCache && Date.now() < statsCache.expiry) {
  return Response.json(statsCache.data);
}

// Límite a 500 jobs para procesamiento (skills, charts, etc.)
const jobs = await jobCol.findMany({ take: 500, orderBy: { createdAt: 'desc' } });
```

### Fix 3: 🟡 React Query — gcTime
**Archivo:** `src/app/providers.tsx`

**Problema:** React Query sin `gcTime` — queries inactivas se quedaban en memoria para siempre, acumulándose con cada navegación.

**Solución:**
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 300_000, // 5 minutos — clean up inactive queries
    },
  },
});
```

### Fix 4: 🟡 Dynamic Import de recharts
**Archivo:** `src/app/(main)/dashboard/page.tsx`

**Problema:** `recharts` (~51KB min + dependencies) cargado inline en el bundle inicial del dashboard.

**Solución:**
```tsx
const JobsChart = dynamic(() => import('@/components/dashboard/jobs-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px]" />,
});
```

---

## 4. Análisis de Causas Raíz Pendientes

### Prioridad Alta

#### A-01: framer-motion en bundle crítico
**Archivo:** `src/lib/page-transitions.tsx`, `src/app/(main)/layout.tsx`

**Diagnóstico:** `framer-motion` con `motion-dom` (93KB) se importa estáticamente en el layout principal. Aunque se usa para animaciones de página, bloques enteros de la librería se cargan en el bundle inicial.

**Impacto estimado:** ~80-100KB en bundle inicial, significante evaluación de scripts.

**Solución propuesta:** Dynamic import del provider de animaciones, o lazy-load de `PageTransitions`.

#### A-02: i18n — Carga de 6 archivos de locale al inicio
**Archivo:** `src/lib/i18n/index.tsx`

**Diagnóstico:** El sistema de internacionalización carga los 6 archivos de locale (en.json, es.json, fr.json, de.json, pt.json) en el bundle. Aunque tree-shaking elimina código muerto, los archivos JSON de traducción (~5-15KB cada uno) se incluyen completos.

**Impacto estimado:** ~30-60KB de JSON en el bundle.

**Solución propuesta:** Carga dinámica solo del locale activo.

#### A-03: Sin compresión de imágenes
**Diagnóstico:** Si hay imágenes en el dashboard (logos, backgrounds, iconos SVG grandes), no están optimizadas con `next/image`.

**Solución propuesta:** Usar `next/image` para cualquier imagen, con formatos modernos (WebP/AVIF).

### Prioridad Media

#### M-01: Re-renders en sidebar y header
**Archivos:** `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`

**Diagnóstico:** Ambos componentes se re-renderizan en cada navegación porque usan `usePathname()` sin `React.memo`.

**Solución propuesta:** Envolver en `React.memo` y memoizar derivaciones de pathname.

#### M-02: Sin prefetching de rutas secundarias
**Diagnóstico:** `next/link` por defecto hace prefetch de rutas en viewport, pero rutas como `/jobs`, `/pipeline`, `/settings` no tienen data prefetching.

**Solución propuesta:** Usar `<link rel="prefetch">` para rutas críticas, o configurar prefetch en los links del sidebar.

#### M-03: Config store — carga síncrona en cada acceso
**Archivo:** `src/lib/config/store.ts`

**Diagnóstico:** Si el store de configuración lee/escribe el archivo JSON en cada acceso (get/set), puede causar contención de I/O.

**Solución propuesta:** Cache en memoria con lazy-loading.

### Prioridad Baja

#### B-01: Google API client (auth) pesado
**Diagnóstico:** `google-auth-library` y `googleapis` son paquetes grandes (~200KB+) que se importan en el servidor. Si están disponibles en bundles client-side (por importaciones incorrectas), añaden peso innecesario.

**Solución propuesta:** Verificar que no haya importaciones client-side de estos paquetes.

#### B-02: Revisar bundle de nodemailer y pdf-parse
**Diagnóstico:** Son módulos server-side grandes. Si algún API route los importa en el bundle client-side (por co-locación en App Router), añaden peso muerto.

**Solución propuesta:** Verificar que solo se usen en server components o API routes.

---

## 5. Plan de Acción Detallado

### Fase 2: Rendimiento en Desarrollo (Siguiente Sprint)

| ID | Tarea | Archivo(s) | Esfuerzo | Impacto | Dependencias |
|----|-------|------------|----------|---------|-------------|
| 2.1 | Dynamic import de framer-motion | `page-transitions.tsx`, `layout.tsx` | 2h | Alto | Ninguna |
| 2.2 | Lazy loading de locales i18n | `i18n/index.tsx` | 1h | Medio | Ninguna |
| 2.3 | React.memo en sidebar + header | `sidebar.tsx`, `header.tsx` | 30min | Bajo-Medio | Ninguna |
| 2.4 | Optimizar imágenes con next/image | Varios | 1h | Medio | Identificar imágenes |

### Fase 3: Medición en Producción

| ID | Tarea | Esfuerzo | Impacto | Dependencias |
|----|-------|----------|---------|-------------|
| 3.1 | Build de producción + `next start` | 30min | — | Fase 2 |
| 3.2 | Lighthouse en modo producción | 30min | — | 3.1 |
| 3.3 | Web Vitals en producción (RUM) | 1h | Preventivo | 3.1 |
| 3.4 | Establecer performance budget en CI | 2h | Preventivo | 3.1 |

### Fase 4: Optimización Profunda (Backlog)

| ID | Tarea | Esfuerzo | Impacto | Notas |
|----|-------|----------|---------|-------|
| 4.1 | Analizar bundle con `@next/bundle-analyzer` | 1h | Diagnóstico | Ver qué pesa exactamente |
| 4.2 | Code-splitting por ruta | 2h | Alto | Next.js App Router ya lo hace, pero verificar |
| 4.3 | Server Components donde sea posible | 3h | Alto | Mover data fetching a RSC |
| 4.4 | SWC minify + optimizaciones avanzadas | 1h | Medio | Configuración en next.config |
| 4.5 | Virtual scrolling para lista de jobs | 3h | Medio | Si hay listas largas |

---

## 6. Presupuesto de Rendimiento (Performance Budget)

Este es el objetivo para **producción** (no dev):

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| **LCP** | < 2.5s | Lighthouse / Web Vitals |
| **TBT** | < 200ms | Lighthouse |
| **CLS** | < 0.05 | Lighthouse / Web Vitals |
| **FCP** | < 1.8s | Lighthouse |
| **Speed Index** | < 3.0s | Lighthouse |
| **Performance Score** | ≥ 85/100 | Lighthouse |
| **INP** (Interaction to Next Paint) | < 200ms | Lighthouse / Web Vitals |
| **Bundle JS inicial** | < 200KB gzipped | Bundle Analyzer |
| **API /api/stats (p95)** | < 200ms | Server timing |
| **Total requests** | < 30 | Network tab |

| **INP** (Interaction to Next Paint) | < 200ms | Lighthouse / Web Vitals |

### Budget para CI (Futuro)

```bash
# lighthouse-ci.config.json (propuesto)
{
  "ci": {
    "assert": {
      "categories:performance": ["warn", { "minScore": 0.85 }],
      "categories:accessibility": ["error", { "minScore": 0.9 }],
      "categories:seo": ["error", { "minScore": 0.9 }]
    }
  }
}
```

---

## 7. Métrica de Éxito

### Criterios de Aceptación

- [ ] **Lighthouse Performance Score ≥ 85/100** en producción
- [ ] **LCP ≤ 2.5s** en producción (vs 9.4s actual en dev)
- [ ] **TBT ≤ 200ms** en producción (vs 2,280ms actual en dev)
- [ ] **Sin OOM** — la app carga consistentemente sin crashear
- [ ] **Bundle inicial ≤ 200KB** gzipped
- [ ] **Stats API ≤ 200ms** (p95)
- [ ] **Tests existentes pasan** (111 tests)
- [ ] **Build sin errores** ✅

### Cómo mediremos

```bash
# Producción
npm run build && npm run start
lighthouse http://localhost:3000/dashboard --output json

# Bundle size (Futuro)
npx @next/bundle-analyzer

# Web Vitals en tiempo real (Futuro)
npm install web-vitals
# + reportWebVitals() en _app.tsx
```

---

## 8. Apéndice: Bundle Analysis

### Estado Actual (dev mode)

| Chunk | Tamaño | % del total |
|-------|--------|-------------|
| Framework (Next.js + React) | ~393KB | 27% |
| framer-motion / motion-dom | ~93KB | 7% |
| recharts (ya code-splitted ✅) | ~51KB | 4% |
| i18n locales (6 JSONs) | ~60KB | 4% (optimizable: lazy load solo activo) |
| UI Components | ~150KB | 11% |
| Otros (axios, cheerio, etc.) | ~680KB | 47% |
| **Total sin comprimir** | **~1.43MB** | 100% |
| **Estimado con Gzip** | **~400KB** | — |

### Estado Objetivo (producción optimizada)

| Chunk | Tamaño Objetivo | Técnica |
|-------|-----------------|---------|
| Framework | ~250KB | Inherente (poco optimizable) |
| framer-motion | ~20KB (lazy) | Dynamic import |
| recharts | ~51KB (lazy) | ✅ Ya code-splitted |
| i18n | ~10KB (1 locale) | Lazy load solo activo |
| UI Components | ~80KB | Tree-shaking + minificación |
| Otros | ~100KB | Agresivo tree-shaking |
| **Total gzipped** | **~200KB** | |

---

### RUM Measurement — Plan de Implementación

Para medir Web Vitals con usuarios reales (Real User Monitoring):

1. Instalar `npm install web-vitals`
2. Crear archivo `src/lib/web-vitals.ts`:
```tsx
'use client';
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onLCP(console.log);
  onINP(console.log);
  onCLS(console.log);
  onFCP(console.log);
  onTTFB(console.log);
}
```
3. Agregar en `src/app/layout.tsx`:
```tsx
import { reportWebVitals } from '@/lib/web-vitals';
reportWebVitals();
```

---

## Histórico de Revisiones

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2025-05-25 | 1.0 | Versión inicial con datos de Lighthouse audit |
