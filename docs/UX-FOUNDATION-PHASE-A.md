# KTIVAR — UX/UI Phase A: visual foundation

Status: proposed for review. The default branch is unchanged.

## Scope
This phase refines existing shared CSS without replacing the UI, adding JavaScript, libraries or new endpoints.

- Semantic tokens for subtle radius, elevation, focus and transition.
- Comfortable panel edges on operational cards and settings surfaces.
- Clearer secondary type hierarchy and readable panel descriptions.
- Subtle hover and keyboard focus on dashboard KPI links and action shortcuts.
- Focus-visible state on the real account summary.
- Reduced motion respected.

## Preserved
Current palette (#2563EB, #1D4ED8, #0F172A, #F6F8FC), locally hosted Inter, real data and KPI definitions, authentication, Supabase, redirects, PWA, QR/NFC, current menu and responsive layout.

## Next phases (not implemented by this PR)
B: dashboard composition with existing data.
C: real-data charts and skeletons.
D: consistent patterns across operational modules.

## Validation criteria before merge
- npm ci; npm run security; npm run build; npm test.
- If Playwright is available: node scripts/verify-responsive.js.
- Manually review desktop (1440px), mobile (390px), compact (320px), landscape and 200% zoom.
- Check hover, keyboard focus, contrast and long content in clients, plates and dashboard.
- Review the diff and merge only after approval.

## Risks
CSS is shared across multiple modules. Although changes are scoped to .app-shell and do not alter HTML or JS, appearance regressions are possible. PR review and browser checks remain mandatory.
