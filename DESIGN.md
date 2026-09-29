# FinTrack Design System & Direction

> **Identity:** Modern Warm Fintech
> **Dial:** ENERGY 2 / RHYTHM 2 / MOTION 1
> **Audience:** Personal, family, and power users managing multi-wallet finances, budgeting, bills, and investments.

---

## 1. Aesthetic & Mood
- **Core feel:** Tactile, trustworthy, editorial, warm yet mathematically precise.
- **Canvas:** Warm stone & paper tones in light mode (`#FBFBF9`, `#F4F2EC`, `#EAE7E0`), deep slate & rich charcoal in dark mode (`#141517`, `#1C1E22`, `#26292E`).
- **Accent:** Warm Gold / Amber (`#F59E0B` / `#D97706` / `#EAB308`) used deliberately at key focal points (primary CTA, active navigation accent, milestone highlights), not sprayed everywhere.
- **Functional Semantics:**
  - Income / Surplus / Profit: Forest Green (`#16A34A`, bg `rgba(22, 163, 74, 0.08)`)
  - Expense / Debt / Loss: Crimson Rose (`#E11D48`, bg `rgba(225, 29, 72, 0.08)`)
  - Warning / Due soon: Amber Gold (`#D97706`, bg `rgba(217, 119, 6, 0.08)`)
  - Informational / Transfer: Slate Blue (`#2563EB`, bg `rgba(37, 99, 235, 0.08)`)

## 2. Typography & Numbers
- **Body & Headlines:** Clean grotesque (`Inter`, system fallback).
- **Numbers & Currencies:** Strict tabular numerals (`tabular-nums`, `font-mono` where appropriate) to ensure ledger alignment and effortless visual scanning.
- **Hierarchy:** Strong contrast between primary KPI values (`text-2xl font-bold tracking-tight`) and supporting metadata (`text-xs font-medium text-muted`).

## 3. Surface & Elevation
- **Cards & Surfaces:** Flat to subtle elevation with crisp hairline borders (`1px solid var(--border)`).
- **Radius:** Consistent hierarchy:
  - Small tags / badges: `rounded-md` (6px)
  - Buttons & Inputs: `rounded-lg` (8px)
  - Cards & Panels: `rounded-xl` (12px)
  - Modals & Floating sheets: `rounded-2xl` (16px)
- **Shadows:** Minimal, purposeful elevation markers (`shadow-sm`, `shadow-md` for modals), never floating or hazy.

## 4. Layout & Rhythm
- **Top Shell:** Refined topbar with clear search/filter access, real wallet balance indicator, notifications, and theme switch.
- **Sidebar:** Categorized, collapsible, distinct active states with warm amber indicators, clear iconography without clutter.
- **Content Pages:** Header with concise action bar, primary summary card / focal point, followed by structured data tables or interactive cards with robust empty and loading states.
- **Responsive:** Fluid reflow from 360px mobile viewports (with bottom navigation / drawer) to widescreen 1440px+ displays.
