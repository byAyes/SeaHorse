# Seahorse

## Register

Product — design serves the tool. Users come to accomplish tasks (upload CVs, view matches, run pipelines), not to browse marketing content.

## Users

Individual job seekers — professionals actively looking for their next role or passively monitoring the market. They are technical enough to use a dashboard but want automation, not complexity. They value speed, clarity, and trustworthiness in a job search tool.

## Product Purpose

Automate job search through multi-source scraping, AI profile extraction, weighted matching, and email digests. Reduce the manual overhead of checking multiple job boards daily. Deliver a dashboard that gives job seekers a clear, data-driven view of their opportunities.

## Brand Personality

Premium & refined — polished, sophisticated, high-end. Every detail should feel intentional and crafted. The interface should convey capability and trust. Job search is stressful; the design should feel like a calm, capable assistant, not another source of noise.

Values:

- **Trustworthy** — users are sharing CVs and career data. The interface must feel secure and reliable.
- **Precise** — scores, stats, and data visualizations must be clear and accurate. No decorative fluff that obscures information.
- **Premium** — small details (micro-animations, glass effects, careful typography) that signal quality without getting in the way.
- **Empathetic** — job search is an emotional process. Empty states, error messages, and loading states should be helpful, not cold.

## Tone

Professional, direct, assured. No playfulness or gamification. Copy is concise and helpful. Spanish-first in the current build (ES locale), but the design must support 5 languages (EN, ES, PT, FR, DE) gracefully.

## Anti-References

- **Not generic SaaS.** Avoid the typical light-cream / white + blue accent clone aesthetic. No pastel-heavy dashboards, no oversized hero metrics (big number + small label), no identical card grids.
- **Not dark-terminal.** Do not lean into cyberpunk, neon, or terminal-inspired design. The dark mode should be rich and deep, not high-contrast or aggressive.
- **Not AI-generated.** Every interface element should feel intentional, not templated. No side-stripe borders, no gradient text, no glassmorphism as default.

## Accessibility

- Support WCAG 2.1 AA contrast ratios in both light and dark modes.
- Dark mode is not an afterthought — design both themes simultaneously.
- `prefers-reduced-motion` is already respected; maintain this.
- Focus indicators must be visible across all themes.

## Strategic Principles

1. **Data density with clarity.** Job seekers want to scan many matches quickly. Information-dense views (tables, compact cards) are preferred when they remain readable.
2. **Progressive disclosure.** Show scores and breakdowns on demand (modals), not all at once. The overview should be scannable, the details expandable.
3. **State completeness.** Every component must handle loading, empty, error, and success states. The product currently does this well in most places.
4. **Dark and light as equals.** Both themes are first-class citizens. Test all components in both modes.
