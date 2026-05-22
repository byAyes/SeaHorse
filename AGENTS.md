# Project Skills

> These skills define the design system, frontend approach, and agent orchestration patterns for this project.
> The AI assistant MUST load these skills when working on tasks matching their descriptions.

| Skill            | When to use                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui-ux-pro-max`  | Building UI components, design systems, layouts, styling — premium design with semantic palettes, editorial typography, 8px spacing system |
| `superpowers`    | Discovering and using available skills to supercharge development — always check this skill before starting complex tasks                  |
| `agentic-skills` | Multi-agent orchestration, dispatching parallel agents, structuring complex workflows across sub-agents                                    |

---

# Frontend Layout & Design Conventions

> These conventions were established during the `impeccable layout` and `impeccable polish` sessions.
> New agents MUST follow these patterns when writing or modifying frontend code.

## 1. Layout Architecture

| Convention           | Implementation                                                                                             | Files                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Ambient accent**   | Single radial gradient glow in `src/app/(main)/layout.tsx` — NOT duplicated per page                       | `layout.tsx` `dashboard/page.tsx` `jobs/page.tsx` `pipeline/page.tsx` `settings/page.tsx` `upload/page.tsx` |
| **Page padding**     | `p-4 sm:p-6` on the `motion.div` wrapper inside `<main>`                                                   | All page-level motion wrappers                                                                              |
| **Page transitions** | `AnimatePresence mode="wait"` with `PageTransitionProvider` — spring animations, 200 stiffness, 20 damping | `layout.tsx`, `src/lib/page-transitions.tsx`                                                                |

## 2. Spacing Utility System

Use these CSS utility classes (defined in `globals.css`) for consistent vertical rhythm instead of ad-hoc margin/padding:

| Class                                   | Use for                                  | Value                          |
| --------------------------------------- | ---------------------------------------- | ------------------------------ |
| `.section-spacing` / `.section-padding` | Between top-level sections on a page     | `2.5rem`                       |
| `.card-spacing` / `.card-padding`       | Between cards within a section           | `1.5rem`                       |
| `.element-spacing` / `.element-padding` | Between elements within a card           | `1rem`                         |
| `.inset-spacing` / `.inset-padding`     | Compact layouts within groups            | `0.75rem`                      |
| `.rhythm-divider`                       | Full-width `<hr>` with dark mode support | Same as section-spacing margin |

## 3. Form Grouping Convention (Settings Page)

When grouping form fields into logical sub-sections inside a Card:

```tsx
{
  /* Section heading */
}
<div>
  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
    {t('settings.email.server')}
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{/* Fields here */}</div>
</div>;

{
  /* Divider between groups — extends to card edges via -mx-6 */
}
<div className="h-px bg-slate-200 dark:bg-slate-700 -mx-6" />;

{
  /* Next group */
}
<div>
  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
    {t('settings.email.credentials')}
  </p>
  ...
</div>;
```

### Translation Key Naming

- **Group headings**: use dedicated keys (e.g. `settings.email.server`, `settings.email.credentials`, `settings.email.addresses`) — NOT repurposed input labels
- **Input labels**: keep original keys (e.g. `settings.email.host`, `settings.email.port`) — use only on standalone fields, not on grouped placeholder-only fields
- **All 5 locale files** (en, es, de, fr, pt) must be kept in sync when adding keys

## 4. Table Sort Convention (Jobs Page)

Sortable table headers use a discriminated union pattern with directional indicators:

```tsx
// Column definition — each element has sortable/sortKey/hideMobile
{ label: t('jobs.table.title'), sortable: true as const, sortKey: 'title' as SortKey, hideMobile: false }
{ label: t('jobs.table.location'), sortable: false as const, sortKey: undefined, hideMobile: true }

// Header rendering with aria-sort + directional icon
<th
  onClick={col.sortable ? () => toggleSort(col.sortKey!) : undefined}
  aria-sort={col.sortable && sortKey === col.sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
>
  <span className="inline-flex items-center gap-1">
    {col.label}
    {col.sortable && sortKey === col.sortKey ? (
      sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
    ) : col.sortable ? (
      <ArrowUpDown size={12} className="text-slate-400" />
    ) : null}
  </span>
</th>
```

### Sort Icon Rules

| Column state         | Icon                                   |
| -------------------- | -------------------------------------- |
| Active + ascending   | `ArrowUp`                              |
| Active + descending  | `ArrowDown`                            |
| Sortable, not active | `ArrowUpDown` (muted `text-slate-400`) |
| Not sortable         | No icon                                |

## 5. Responsive Table Pattern

- Wrapper: `<div className="table-responsive"><table>...</table></div>` (defined in `globals.css` — sets `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, `min-width: 600px` on table)
- Mobile-hidden columns: `hidden sm:table-cell`
- No negative margin hacks — use `.table-responsive` instead of `overflow-x-auto -mx-4 sm:mx-0`

## 6. Upload Step Flow

Processing steps (`src/app/(main)/upload/page.tsx`) must mirror pipeline step conventions:

| Property                | Upload                         | Pipeline                         |
| ----------------------- | ------------------------------ | -------------------------------- |
| Step spacing            | `pb-8`                         | `pb-8`                           |
| Pending text color      | `text-slate-500`               | `text-slate-500`                 |
| Pending connector color | `rgb(203 213 225)` (slate-300) | `bg-slate-200 dark:bg-slate-700` |
| Spinning icon scale     | `[1, 1.2, 1]`                  | `[1, 1.2, 1]`                    |
| Type safety             | `ProcessStep['status']`        | `ProcessStep['status']`          |

## 7. Page Animation Pattern

All pages follow the same entrance animation:

```tsx
<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
  <h2 className="text-xl font-semibold">{t('page.title')}</h2>
  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('page.subtitle')}</p>
</motion.div>
```

Cards within pages use staggered spring animations with `delay` progression (0.05, 0.1, 0.15, 0.2, 0.25).

---

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED

Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED

Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:

- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED

Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)

Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:

- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)

If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)

Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command       | Action                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| `ctx stats`   | Call the `stats` MCP tool and display the full output verbatim                    |
| `ctx doctor`  | Call the `doctor` MCP tool, run the returned shell command, display as checklist  |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
