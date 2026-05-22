---
colors:
  primary: '#4f46e5'
  primary-light: '#6366f1'
  primary-dark: '#3730a3'
  success: '#059669'
  warning: '#d97706'
  danger: '#dc2626'
  surface: '#ffffff'
  surface-secondary: '#fafbfc'
  surface-tertiary: '#f1f4f9'
  dark-surface: '#0b1120'
  dark-surface-secondary: '#111827'
  dark-surface-tertiary: '#1f2937'
  text-light: '#0f172a'
  text-dark: '#f1f5f9'
  border-light: oklch(0.928 0.006 264.531 / 0.25)
  border-dark: oklch(0.373 0.034 259.733 / 0.35)
typography:
  sans: Inter
  heading: Plus Jakarta Sans
  mono: JetBrains Mono
  body-size: 14px
  scale-ratio: 1.25
rounded:
  card: 0.875rem
  modal: 1.125rem
  button: 0.5rem
  input: 0.5rem
  badge: 9999px
spacing:
  section: 2.5rem
  card: 1.5rem
  element: 1rem
  inset: 0.75rem
easing:
  out: cubic-bezier(0.23, 1, 0.32, 1)
  spring: cubic-bezier(0.34, 1.56, 0.64, 1)
  gentle: cubic-bezier(0.25, 0.46, 0.45, 0.94)
motion-duration:
  fast: 150ms
  normal: 250ms
  slow: 300ms
components:
  card: radius-xl, shadow-sm, border, hover:shadow-md
  button: radius-md, px-4 py-2, font-medium
  badge: radius-full, px-2.5 py-1, text-xs font-medium
  input: radius-md, px-3 py-2, border
  modal: radius-xl, shadow-2xl, glass-strong
  skeleton: shimmer animation, 2s infinite
  sidebar: w-[240px] collapsed:w-[60px], border-r, glass
---

## Overview

Seahorse uses a premium, refined design system built on indigo (primary #4f46e5) with warm-light and deep-dark surfaces. The system emphasizes glass morphism (subtle, not decorative), layered shadows, and restrained use of color. Dark mode is a first-class citizen — deep navy-based surfaces (#0b1120) with reduced chroma borders. A subtle noise texture and radial gradient glow backgrounds add depth without distraction.

The system is built with Tailwind CSS 4 `@theme` directives and Framer Motion for animation. Tokens are defined in `src/app/globals.css`.

The register is **Product** — a dashboard UI where design serves the tool. Data density, scanability, and trust are the primary UX goals.

## Colors

### Light Mode

| Role              | Token                       | Value                             | Usage                             |
| ----------------- | --------------------------- | --------------------------------- | --------------------------------- |
| Primary           | `--color-primary`           | #4f46e5                           | Buttons, links, active states     |
| Primary Light     | `--color-primary-light`     | #6366f1                           | Hover states, glow effects        |
| Primary Dark      | `--color-primary-dark`      | #3730a3                           | Active pressed states             |
| Surface           | `--color-surface`           | #ffffff                           | Card backgrounds, raised surfaces |
| Surface Secondary | `--color-surface-secondary` | #fafbfc                           | Page background                   |
| Surface Tertiary  | `--color-surface-tertiary`  | #f1f4f9                           | Skeleton states, subtle fills     |
| Success           | `--color-success`           | #059669                           | Score badges, positive indicators |
| Warning           | `--color-warning`           | #d97706                           | Medium-match badges               |
| Danger            | `--color-danger`            | #dc2626                           | Errors, negative indicators       |
| Border            | —                           | oklch(0.928 0.006 264.531 / 0.25) | All borders                       |

### Dark Mode

| Role              | Token                            | Value                             | Usage                        |
| ----------------- | -------------------------------- | --------------------------------- | ---------------------------- |
| Surface           | `--color-dark-surface`           | #0b1120                           | Page background              |
| Surface Secondary | `--color-dark-surface-secondary` | #111827                           | Card backgrounds             |
| Surface Tertiary  | `--color-dark-surface-tertiary`  | #1f2937                           | Skeleton states, hover fills |
| Surface Raised    | `--color-dark-surface-raised`    | #1e293b                           | Modals, elevated cards       |
| Border            | —                                | oklch(0.373 0.034 259.733 / 0.35) | All borders                  |

### Semantic Color Usage

- **Score badges**: `>=80` → success (emerald), `>=60` → warning (amber), `<60` → default (slate)
- **Errors**: Red (#dc2626) with light red background (#fee2e2) in light, reduced opacity in dark
- **Success states**: Emerald (#059669) with emerald-light background (#d1fae5)
- **Accent per page**: Dashboard → primary, Upload → emerald, Jobs → amber, Pipeline → violet, Settings → sky

### Selection

- Light: background `rgb(79 70 229 / 0.15)`, text `rgb(79 70 229)`
- Dark: background `rgb(79 70 229 / 0.25)`, text `rgb(165 180 252)`

## Typography

| Role    | Font                         | Weight Range | Usage                                   |
| ------- | ---------------------------- | ------------ | --------------------------------------- |
| Sans    | Inter (variable)             | 400-700      | Body text, labels, table content        |
| Heading | Plus Jakarta Sans (variable) | 400-800      | Page titles, card titles, sidebar brand |
| Mono    | JetBrains Mono               | 400          | Log viewer, code snippets               |

### Scale

- Body: 14px (text-sm) with `letter-spacing: -0.01em`
- Scale ratio: 1.25 between steps
- Font features: `cv02`, `cv03`, `cv04`, `cv11`, `salt` enabled
- Text rendering: `optimizeLegibility`

### Hierarchy

- Page titles: text-lg/sm:text-xl, font-semibold or font-bold, heading font
- Card titles: text-sm or text-base, font-semibold, heading font
- Body: text-sm, sans font
- Labels/Stats: text-xs, text-[10px], font-medium, uppercase where appropriate
- Code/Logs: text-xs, mono font

## Elevation

| Level          | Light                                                                                                   | Dark                             | Usage                            |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| Card           | `0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px -1px rgb(0 0 0 / 0.04), 0 1px 4px -2px rgb(0 0 0 / 0.02)`     | Same (lower opacity in practice) | Default card state               |
| Card Hover     | `0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 6px -1px rgb(0 0 0 / 0.03), 0 8px 20px -6px rgb(0 0 0 / 0.04)` | —                                | Interactive cards on hover       |
| Card Raised    | `0 8px 24px -6px rgb(0 0 0 / 0.08), 0 4px 12px -4px rgb(0 0 0 / 0.04)`                                  | —                                | Elevated cards, active states    |
| Modal          | `0 25px 50px -12px rgb(0 0 0 / 0.25), 0 4px 12px -4px rgb(0 0 0 / 0.08)`                                | —                                | Modals, drawers                  |
| Nav            | `0 1px 2px 0 rgb(0 0 0 / 0.03)`                                                                         | —                                | Header, sidebar                  |
| Glow (Primary) | `0 0 20px -4px rgb(79 70 229 / 0.15)`                                                                   | —                                | Active nav item, primary buttons |

## Motion

### Timing

| Duration | Token        | Usage                                   |
| -------- | ------------ | --------------------------------------- |
| 150ms    | —            | Hover, tap, active state transitions    |
| 180ms    | —            | Page title transitions                  |
| 200ms    | —            | Log appearance                          |
| 250ms    | `--ease-out` | Sidebar collapse, modal open/close      |
| 300ms    | —            | Layout transitions, scroll-based header |
| 600ms    | —            | Chart bar animations, score bar fill    |

### Easing

| Curve            | Value                               | Usage                                 |
| ---------------- | ----------------------------------- | ------------------------------------- |
| Ease Out (quart) | `cubic-bezier(0.23, 1, 0.32, 1)`    | Default transitions, sidebar collapse |
| Ease In/Out      | `cubic-bezier(0.77, 0, 0.175, 1)`   | Page transitions                      |
| Ease Drawer      | `cubic-bezier(0.32, 0.72, 0, 1)`    | Mobile drawer                         |
| Ease Spring      | `cubic-bezier(0.34, 1.56, 0.64, 1)` | WhileHover, whileTap, badge selection |

### Animated Elements

- **Sidebar**: Active indicator layoutId spring animation, icon hover/tap scale, collapse rotation
- **Page transitions**: Framer Motion AnimatePresence with direction-aware variants (x-offset + blur)
- **Score bars**: Width animation from 0 to target on mount
- **Stats numbers**: Spring entrance with scale variation
- **Log viewer**: Sequential opacity + x offset for each log line
- **Pipeline steps**: Sequential entrance, pulse animation on running state, scale pulse on spinner
- **Mobile nav indicator**: layoutId spring between active tabs
- **Skeleton shimmer**: 2s infinite linear shimmer animation

## Components

### Sidebar

- Desktop: fixed left, w-60/collapsed:w-[60px], glass backdrop, dark mode support
- Mobile: drawer overlay (spring slide from left) + bottom nav bar
- Active state: gradient background + left glow bar + sparkle icon, animated with layoutId
- Transition: 300ms ease-out on collapse, 250ms spring on mobile open
- Border: right border + top gradient accent bar

### Header

- Sticky top, glass backdrop, dynamic shadow on scroll
- Per-page gradient accent bar (primary/emerald/amber/violet/sky)
- Animated page title with blur-in transition on route change
- Right side: language toggle + theme toggle with divider

### Card

- Rounded-xl (0.875rem), shadow-sm, border, white/dark-surface background
- Hover: shadow-md, primary border glow on interactive cards
- Header: flex with icon + title in heading font
- Content: inner spacing (p-4/p-6), optional table content with p-0

### Card Grid

- Responsive: 1 col mobile → 2 col tablet → 3/4 col desktop
- Gap: 4-6 (varies by context)
- Quick actions: 2-col mobile → 4-col desktop, compact (p-2.5/p-3)

### Table (Jobs Page)

- Responsive wrapper with horizontal scroll on mobile (min-width: 640px)
- Sortable headers with hover state + ArrowUpDown icon
- Row animation: staggered entrance (25ms delay), spring
- Score badges: color-coded by range
- Mobile: hides company/location/salary/date columns, shows score badge + external link
- Hover: subtle background change on row

### Badge

- Rounded-full, text-xs font-medium
- Variants: default (slate), success (emerald), warning (amber), danger (red), outline
- ScoreBadge variant: color-coded by threshold

### Button

- Rounded-md (0.5rem), font-medium
- Variants: primary (indigo fill), outline (border), ghost (no background), secondary (slate fill)
- Sizes: sm (px-3 py-1.5 text-xs), default (px-4 py-2 text-sm)
- Icon support: inline with gap-2

### Modal

- Rounded-xl (1.125rem), shadow-modal, glass-strong backdrop
- Overlay: black/40 with backdrop-blur-sm
- Sizes: sm, md (default), lg
- Content: spaced sections with score breakdown grid, matched skills, description

### Input

- Rounded-md (0.5rem), border, px-3 py-2, focus ring primary/50
- Label support via prop, helper text below

### Dropzone (Upload)

- Dashed border, centered icon + text, drag-active state with primary glow
- Transitions on drag state

### Skeleton

- Shimmer animation (2s), 90deg gradient, dark mode variant
- Custom widths for different content types

### Toast

- Duration: 3000ms for success, 5000ms for error
- Variants: success (emerald), error (red), info (primary)

## Do's and Don'ts

### Do

- **Use glass sparingly.** The `glass` utility class exists but should be reserved for overlays and the sidebar — not every card needs a blur backdrop.
- **Let data breathe.** The jobs table and pipeline results should prioritize scannability over decorative elements. Table rows need compact padding.
- **Animate with purpose.** Spring animations for navigation (sidebar, mobile drawer). Opacity + translate for content entrance. Never animate layout properties.
- **Design both themes simultaneously.** Every new component must have light and dark variants before shipping.
- **Empty states that teach.** When there's no data, explain what the user can do next and provide a clear CTA.
- **Use the heading font for hierarchy.** Plus Jakarta Sans at font-bold signals importance. Reserve Inter for body content.
- **Score badges by threshold.** Use the ScoreBadge component with consistent thresholds: >=80 emerald, >=60 amber, <60 default.

### Don't

- **Don't use side-stripe borders.** No `border-left` or `border-right` colored accents on cards, list items, or callouts.
- **Don't use gradient text.** No `background-clip: text` with gradients. Use solid indigo or bold weight for emphasis.
- **Don't over-glass.** Glassmorphism is for the sidebar and modals only. Cards should use solid backgrounds with subtle shadows.
- **Don't use hero metrics.** Avoid the big-number + small-label + gradient accent pattern. Stats should be compact and contextual.
- **Don't nest cards.** A card inside a card is always wrong. Use different components or restructure the layout.
- **Don't use identical card grids.** Vary sizes and content types. Avoid repeating icon + heading + text in every card.
- **Don't bounce or elastic ease.** No bounce-in animations. Use exponential ease-out (quart/quint) for all motion.
- **Don't use display fonts in UI.** Plus Jakarta Sans is for headings only. Never use it for body text, labels, or data.
- **Don't reinvent navigation.** Sidebar + header is a standard pattern. Don't deviate from it.
