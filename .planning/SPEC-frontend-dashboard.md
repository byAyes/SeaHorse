# Spec: Frontend UI Dashboard para Pipeline de Jobs

## Objective

Build a modern, interactive Single Page Application (SPA) dashboard for the Seahorse job scraping/matching pipeline. The dashboard will allow users to:

- Upload CVs/PDFs and see extracted profiles
- Configure email recipients and run the pipeline
- View job matching results with animated stats and scores
- Monitor pipeline execution with live progress
- Manage settings (API keys, profile preferences)

## Tech Stack

| Layer       | Technology               | Version | Notes                                                                        |
| ----------- | ------------------------ | ------- | ---------------------------------------------------------------------------- |
| Framework   | **Next.js** (App Router) | ^16.2.1 | Already in project — we use what's installed                                 |
| Language    | TypeScript (strict)      | ^6.0.2  | Already configured                                                           |
| UI Library  | React                    | ^19.2.4 | Already installed                                                            |
| Styling     | **Tailwind CSS v4**      | latest  | Need to install — Next.js 16 has built-in support via `@tailwindcss/postcss` |
| Icons       | **Lucide React**         | latest  | SVG icon library, pairs well with Tailwind                                   |
| Animations  | **Framer Motion**        | latest  | Staggered animations, micro-interactions, skeleton screens                   |
| Charts      | **Recharts**             | latest  | Dashboard stats charts                                                       |
| HTTP        | **TanStack Query**       | latest  | API data fetching with caching                                               |
| State       | **Zustand**              | latest  | Lightweight global state management                                          |
| Package Mgr | npm                      | —       | Already configured                                                           |

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (existing)

# Build
npm run build        # Production build

# Type Check
npx tsc --noEmit    # TypeScript check

# Add dependencies
npm install <pkg>   # Install new packages
```

## Project Structure (to be created)

```
src/
  app/
    layout.tsx           # Root layout with providers, theme, fonts
    page.tsx             # Dashboard home — redirects or shows main dashboard
    globals.css          # Tailwind imports, CSS variables, design tokens
    dashboard/
      page.tsx           # Main dashboard page
    upload/
      page.tsx           # CV/PDF upload page
    jobs/
      page.tsx           # Job results table
    settings/
      page.tsx           # Settings panel
    pipeline/
      page.tsx           # Pipeline runner page
    api/                 # Existing API routes (unchanged)

  components/
    ui/                  # Primitive UI components
      button.tsx
      card.tsx
      input.tsx
      modal.tsx
      skeleton.tsx
      badge.tsx
      toast.tsx
    dashboard/
      stats-grid.tsx     # Animated stats cards
      jobs-chart.tsx     # Recharts job trend chart
      recent-jobs.tsx    # Recent matched jobs list
    upload/
      dropzone.tsx       # Drag & drop PDF upload zone
      preview-card.tsx   # Upload preview
    jobs/
      jobs-table.tsx     # Filterable/sortable job table
      job-card.tsx       # Individual job match card
      score-badge.tsx    # Match score indicator
    pipeline/
      pipeline-runner.tsx # Pipeline execution & progress
      log-viewer.tsx     # Live log viewer
    settings/
      email-config.tsx   # Email configuration form
      api-keys.tsx       # API key manager
      profile-form.tsx   # User profile preferences
    layout/
      sidebar.tsx        # Navigation sidebar
      header.tsx         # Top header bar
      theme-toggle.tsx   # Dark/light mode toggle

  lib/
    api-client.ts        # TanStack Query hooks & API functions
    store.ts             # Zustand stores
    utils.ts             # Utility functions (cn(), formatters)

  hooks/
    use-pipeline.ts      # Pipeline execution hook
    use-jobs.ts          # Jobs data hook
    use-profile.ts       # Profile data hook
```

## Code Style

```typescript
// Naming: camelCase for variables/functions, PascalCase for components/types
// Imports: React first, then libraries, then local — grouped with line breaks

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useJobs } from "@/hooks/use-jobs";
import { cn } from "@/lib/utils";

// Components: functional with explicit return types, destructured props
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border bg-card p-6", className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{title}</span>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
    </motion.div>
  );
}
```

## Design System

**Style**: Modern-minimalist dashboard with glassmorphism accents — clean lines, subtle shadows, generous white space.

**Color Palette**:

- Background: slate-50 (light) / slate-950 (dark)
- Surface: white (light) / slate-900 (dark)
- Primary: indigo-600 → indigo-500
- Accent: emerald-500 (success), amber-500 (warning), rose-500 (error)
- Text: slate-900 (light) / slate-50 (dark)

**Typography**:

- Font: Inter (body) + system sans-serif fallback
- Scale: 12/14/16/18/20/24/32/40
- Body: 16px, line-height 1.6
- Headings: 600 weight, tighter line-height

**Spacing**: 4px/8px incremental system (Tailwind defaults: p-4, gap-4, space-y-6)

**Radius**: rounded-lg (8px) for cards, rounded-xl (12px) for modals, rounded-md (6px) for buttons

**Effects**: Subtle shadows (shadow-sm), backdrop-blur for nav/modals, smooth transitions (duration-200)

## UI Components & Pages

### 1. Dashboard Page (`/dashboard`)

- **Stats Grid**: 4 animated cards — Total Jobs, Matches Found, Profiles Extracted, Pipelines Run
- **Job Trend Chart**: Recharts area chart showing jobs over time (7/30 days)
- **Recent Matches**: List of top-5 matched jobs with score badges
- **Quick Actions**: "Upload CV", "Run Pipeline", "View All Jobs" buttons

### 2. Upload Page (`/upload`)

- **Drop Zone**: Drag & drop area with file preview, progress indicator
- **Profile Preview**: Extracted skills, experience, education displayed after parsing
- **Confirm & Match**: Button to start matching against extracted profile

### 3. Jobs Page (`/jobs`)

- **Filters**: Search bar, category filter, score range slider
- **Results Table**: Sortable columns (title, company, score, location, salary, date)
- **Job Detail Modal**: Full job description with match breakdown
- **Empty State**: Helpful message when no jobs matched yet

### 4. Pipeline Page (`/pipeline`)

- **Run Button**: Prominent "Run Pipeline" CTA with last-run timestamp
- **Progress Tracker**: Animated step indicators (Scraping → Matching → Sending)
- **Log Viewer**: Scrollable log output in terminal-style dark panel
- **Results Summary**: Jobs scraped, matched, and emailed counts

### 5. Settings Page (`/settings`)

- **Email Config**: SMTP fields (host, port, user, password, from, recipient, CC)
- **Profile Preferences**: Skills, interests, location, remote toggle, salary range
- **API Keys**: JSearch API key, Gemini API key inputs (masked)
- **Theme**: Dark/light mode toggle with preview

## API Integration

### Existing Endpoints to Consume

| Endpoint                          | Method | Purpose                      | Page            |
| --------------------------------- | ------ | ---------------------------- | --------------- |
| `/api/match-jobs?userId=...`      | GET    | Get matched jobs with scores | Dashboard, Jobs |
| `/api/profile/extract?userId=...` | GET    | Get user profile             | Settings        |
| `/api/profile/history?userId=...` | GET    | Profile change history       | Settings        |
| `/api/cv/upload`                  | POST   | Upload CV/PDF                | Upload          |
| `/api/cv/process`                 | POST   | Process uploaded CV          | Upload          |
| `/api/cv/update-profile`          | POST   | Update user profile          | Settings        |
| `/api/email/send`                 | POST   | Send email digest            | Pipeline        |
| `/api/pdf/upload`                 | POST   | Upload PDF for matching      | Upload          |
| `/api/pdf/match`                  | POST   | Match PDF against jobs       | Upload          |

- Need to add: `GET /api/stats` for dashboard aggregate stats (or compute client-side)

### API Client Pattern

```typescript
// TanStack Query hooks for each endpoint
export function useJobs(params: MatchJobsParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => fetch(`/api/match-jobs?${toQueryString(params)}`).then((r) => r.json()),
  });
}
```

## Testing Strategy

- **Components**: Jest + React Testing Library for UI component tests
- **Integration**: Verify TanStack Query hooks work with mock API responses
- **Manual**: `npm run dev` — visual verification of all pages
- **Type Check**: `npx tsc --noEmit` — ensure strict type safety

## Boundaries

### Always Do

- Run `npx tsc --noEmit` after any TypeScript changes
- Use existing API types (`Job`, `UserProfile`, `MatchedJob`) from `src/types/`
- Use the `@/` path alias for imports (already configured)
- Add loading/skeleton states for all async data
- Add error boundaries around major sections
- Use semantic color tokens, not raw hex values in components
- Make all interactive elements keyboard-accessible

### Ask First

- Adding new npm packages beyond the spec'd stack (Tailwind, Lucide, Framer Motion, Recharts, TanStack Query, Zustand)
- Changing existing API route signatures or adding new API endpoints
- Modifying the Prisma schema or database models
- Changing the routing structure (Next.js App Router)

### Never Do

- Commit API keys or secrets to the codebase
- Remove error/loading/empty states from components
- Use emoji as icons (use Lucide SVG icons instead)
- Bypass strict TypeScript with `any` casts
- Modify existing API route logic — only create new pages/components

## Success Criteria

- [ ] `npm run dev` starts without errors and serves the dashboard
- [ ] Dashboard shows real stats from API (or graceful empty states when no data)
- [ ] Upload page handles drag & drop PDF upload with profile extraction preview
- [ ] Jobs page displays match results with filtering, sorting, and detail modal
- [ ] Pipeline page has run button with progress animation and log viewer
- [ ] Settings page saves email config, profile, and API keys
- [ ] Dark/light mode toggle works across all pages
- [ ] All pages are responsive (mobile ≥375px → desktop)
- [ ] Loading skeletons and error states present on all data-fetching views
- [ ] `npx tsc --noEmit` passes with zero errors

## Open Questions

1. **Authentication**: Should we add a simple auth layer (even just a user ID selector) or keep it open with a hardcoded user ID for now?
2. **Real-time logs**: Should the pipeline log viewer poll for updates or use WebSocket/SSE?
3. **Stats endpoint**: Do we need a dedicated stats aggregation endpoint, or can we compute from existing data?
