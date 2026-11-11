# FinTrack Design System & Direction

> **Identity:** Smoked Glass Fintech
> **Dial:** ENERGY 2 / RHYTHM 2 / MOTION 2
> **Audience:** Personal, family, and power users managing multi-wallet finances, budgeting, bills, and investments.
> **Reference direction:** Verdelo-style household money app: smoked glass, botanical calm, mint accent.

---

## 1. Aesthetic & Mood

- **Core feel:** Calm, organic, quietly premium. A glass panel resting on a dim green room. Money as something tended, not traded.
- **Canvas:** Deep green-charcoal in dark mode (`#0C1210` base, panels `#111916`), sage mist in light mode (`#DFE6E1` base, panels `#F6F9F7`). All neutrals lean green, never pure grey.
- **Glass:** Cards are translucent tints over a shared dim backdrop veil, with a hairline green-tinted rim (`inset 0 0 0 1px`). Heavy `backdrop-filter` is reserved for exactly two surfaces: the topbar and floating panels (menus, modals). Everything else earns depth from translucency, not blur.
- **Accent:** Mint (`#0F6B45` light / `#6EE0A1` dark) at key focal points only: primary CTA, active navigation, progress fills, the one live metric. Never sprayed.
- **Functional Semantics:**
  - Income / Surplus / Profit: `#11703F` light, `#8EE9B7` dark
  - Expense / Debt / Loss: `#B13B22` light, `#F6A38E` dark
  - Warning / Due soon: `#85560A` light, `#F2C770` dark
  - Nearly-over-budget: `#A85A1F` light, `#F2A86F` dark
  - Informational / Transfer: `#23609A` light, `#A3CBF0` dark
  - Each has a soft tinted background variant at ~12% alpha.
  - Filled pills pair with their own ink token (`--on-success`, `--on-danger`, `--on-primary`) instead of hard-coded white: the dark-mode greens and reds are light, so white-on-fill would be unreadable there.
- **Content colours stay content.** Category, wallet, note, and asset-class colours are user data. They colour dots, bars, and card tints — never small text, because a colour the user picked cannot be guaranteed to pass contrast in both themes.

## 2. Typography & Numbers

- **Body & Headlines:** Urbanist, a geometric-humanist sans with soft terminals. Chosen because its rounded warmth matches the botanical-glass mood; system sans feels institutional next to it.
- **Numbers & Currencies:** Strict tabular numerals (`font-variant-numeric: tabular-nums`) so ledgers align and scan.
- **Scale:** Compact app scale (14px base, 34px display max). Hierarchy comes from weight and ink levels (`--text-primary` vs `--text-muted`), not size jumps.

## 3. Surface & Elevation

- **Cards:** Translucent glass tint + 1px inset rim + one soft green-black shadow. Cards sit _in_ the room, not on top of it.
- **Stat tiles (`.kpi`):** A tile is a card with one hue wash underneath (mint, teal, amber, blue at 10–16% alpha, `--tile-1..4`). The wash marks which group a figure belongs to. It never tints the tile's own text: label and value keep `--text-muted` / `--text-primary`, so a tile cannot fail contrast in either theme.
- **Radius hierarchy:**
  - Small tags / badges: `10px` (`rounded-sm`)
  - Buttons, inputs, nav rows, dropdown items: `14px` (`rounded-md`)
  - Cards & panels: `22px` (`rounded-xl`)
  - Modals & floating sheets: `28px` (`rounded-2xl`)
  - Never `rounded-lg` for controls: the scale maps it to `20px`, which CSS clamps to half a 34–44px control's height, turning every button and nav row into an accidental pill.
- **Shadows:** Deep, soft, greenish-black, used as elevation markers only. Most surfaces stay flat; modals and dropdowns lift.
- **Brand slots:** A tenant's brand colour is written as two raw values (`--brand` for light, `--brand-dark` for a lifted dark variant). Every accent token (`--primary`, `--primary-hover`, `--primary-deep`, `--primary-glow`, `--gradient-primary`) is derived from those in CSS, so switching theme never needs a re-run of `applyBrand` and the two modes cannot drift apart.

## 4. Layout & Rhythm

- **Top Shell:** Frosted topbar (the one allowed blur in the shell) with search, sync state, notifications, theme switch.
- **Sidebar:** A 244px rail (76px collapsed) that behaves like a shelf, not a menu of chips.
  - Top: an app mark in the brand gradient (38px, `12px` radius), the app name at 21px/700 with the tagline under it, and a 32px fold button.
  - Nav: flat 44px rows at `14px` radius with `18px` icons. The active row is the one filled surface in the rail — brand gradient, `--on-primary` ink, soft glow. Groups are separated by hairline rules, not headings.
  - Badges: a small count pill on the rows that have something waiting (unpaid bills). Never a red dot without a number.
  - Bottom, pinned: the "Aman dibelanjakan hari ini" strip (what is left of today after committed bills) and the account row. Both stay put while the nav scrolls under them.
- **Overview composition:** Stat tiles first, then a 12-column card grid (wallet stack, balance, flow, where-the-money-went, recent, side stack). Every panel answers one question in its heading and carries its own empty state.
- **Budget meters carry a pace tick:** the thin mark at today's point in the month. A bar that stops short of it is behind schedule, one that passes it is not — the bar alone cannot say that, because both a slow month and a cheap month look the same.
- **Backdrop:** A fixed, CSS-only ambient veil (soft mint and sage radial glows over the base) sits behind the whole app so glass has something to refract. No photos, no grids, no patterns.
- **Content Pages:** Page header with actions, one focal summary card, then structured tables or cards. Robust empty, loading, and error states everywhere.
- **Motion:** MOTION 2: transitions on interaction (hover, open, tab switch), 150–300ms, `cubic-bezier(0.22, 1, 0.36, 1)`. No perpetual loops; the sync spinner and skeleton shimmer are the only loading motions. `prefers-reduced-motion: reduce` collapses CSS transitions to near-zero and `MotionConfig reducedMotion="user"` does the same for Framer springs — nothing here carries information in movement alone.
- **Touch:** 44px is the floor for anything tappable on a phone. Buttons, nav rows, header controls, filter chips, and row actions all reach it below the `sm` breakpoint; row actions that only appear on hover are always visible on touch.
- **Responsive:** Fluid reflow from 360px (bottom-safe drawer nav) to 1640px+ widescreen. No horizontal scroll at any width; wide tables scroll inside their own container.
