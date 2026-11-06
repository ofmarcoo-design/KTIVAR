# KTIVAR — Neutral UI / Light and Dark themes

## Intent
Keep the approved navy, white and blue brand while making the interface closer to the user's references: less gradient and decorative contrast, compact controls, legible content and restrained elevation.

## Implementation
- No new runtime packages, framework or database migrations.
- New /assets/theme.js is loaded before app.css by all six HTML views to minimize flashes of incorrect theme.
- Theme choices: **Claro**, **Escuro**, **Automático** (system preference).
- The browser stores `ktivar.ui.theme` locally. No external tracking or cookies.
- Theme controls live in the existing account menu on desktop, and adjacent to account settings on narrow screens. These actions are real and update the same preference.
- Existing user actions, authentication, data rendering and module navigation remain unchanged.
- Light remains the default. Automatic is opt-in and reacts to system theme changes.
- Dark theme reuses semantic tokens and explicitly covers legacy hard-coded surfaces, inputs, cards, modal, lists, tables, CRM Kanban and mobile navigation.
- Existing official logo artwork remains unchanged and is not recolored.
- Print output reverts to light tokens.

## Verification
1. `npm ci`, `npm run security`, `npm run build`, `npm test`.
2. Use Chromium browser validation with `node scripts/verify-responsive.js` where Playwright is available.
3. Manually inspect Dashboard, Analytics, Placas, Clientes, Produtos, Vendas, CRM, Atividades, Relatórios and Configurações in both modes.
4. Inspect dialogs, dropdowns, statuses, tables and forms at 320/390/768/1440px and 200% zoom.
5. Confirm theme selector persists after navigation and reload, switching to Automático follows OS changes, and `prefers-reduced-motion` remains respected.
6. Confirm status semantics, QR and data representation are unaffected.

## Known validation gap
CI validates syntax, security and API test contracts. Browser screenshot comparison and manual WCAG contrast review must be completed before merging this PR.
