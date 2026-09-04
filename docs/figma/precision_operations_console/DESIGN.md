---
name: Precision Operations Console
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#4f5d71'
  on-tertiary: '#ffffff'
  tertiary-container: '#67758b'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#d5e3fc'
  tertiary-fixed-dim: '#b9c7df'
  on-tertiary-fixed: '#0d1c2e'
  on-tertiary-fixed-variant: '#3a485b'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  display-sm:
    fontFamily: inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-md:
    fontFamily: inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  mono-currency:
    fontFamily: jetbrainsMono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  mono-identifier:
    fontFamily: jetbrainsMono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
  label-caps:
    fontFamily: inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 2px
  space-xs: 4px
  space-sm: 8px
  space-md: 12px
  space-lg: 16px
  space-xl: 24px
  space-2xl: 32px
  sidebar-width: 240px
  inspector-width: 380px
---

## Brand & Style

This design system establishes an ultra-refined, high-velocity operational workspace designed for finance engineers, operations analysts, and treasury controllers managing automated reconciliation at enterprise scale.

### Aesthetic Paradigm & Philosophy
The aesthetic sits at the intersection of Stripe's immaculate typographic authority and Linear's purposeful, keyboard-driven utility. It rejects decorative bloat, saturated gradient washes, and non-functional embellishments. Instead, it prioritizes:
- **Absolute Legibility & Contrast**: High-density numerical data must be inspectable instantly without cognitive friction.
- **Instrumental Focus**: Chrome, structural containers, and backgrounds retreat to the perimeter, directing visual weight toward ledger discrepancies, automated matching confidence scores, and audit flags.
- **Engineered Restraint**: Color is applied exclusively to signal state changes, user interactions, or reconciliation flags. Neutral grayscale architecture anchors 90% of the visual field.

## Colors

The palette is engineered around high optical clarity on calibrated sRGB displays, optimized for multi-hour operational workflows.

### Surface and Canvas Architecture
- **Base Canvas (`#FFFFFF`)**: Primary backdrop for high-density tabular data grids, raw ledger views, and active documents.
- **Subsurface Muted (`#F8FAFC`)**: Canvas background for structural sidebars, secondary toolbars, metric card headers, and table alternating rows.
- **Surface Elevated (`#FFFFFF`)**: Floating command palettes, modal drawers, and contextual popovers with micro-borders.
- **Divider & Border (`#E2E8F0`)**: Crisp 1px borders providing structure without visual clutter.
- **Divider Subtle (`#F1F5F9`)**: Inner cell borders and micro-horizontal rules.

### Foreground & Typography Colors
- **Primary Text (`#0F172A`)**: Titles, critical ledger amounts, active tab indicators, and primary data values.
- **Secondary Text (`#475569`)**: Column headers, metadata labels, field descriptors, and inactive nav items.
- **Tertiary/Muted Text (`#94A3B8`)**: Placeholder text, breadcrumb separators, and disabled actions.

### Interactive Accents
- **Primary Accent (`#0284C7`)**: Vibrant cobalt/sky reserved strictly for primary execution CTAs ("Execute Batch Reconcile", "Approve Override"), focused inputs, and active primary navigations.
- **Secondary Accent (`#0D9488`)**: Deep slate teal applied exclusively to AI confidence metrics, algorithmic suggestions, and heuristic match tags.

### Status Semantic System
Status tokens exist strictly in matched pairs (100-level tint backgrounds with 700/800-level high-contrast foreground text):
- **Matched / Resolved**: Background `#ECFDF5`, Border `#A7F3D0`, Text `#059669` (Emerald).
- **Anomaly / Pending Action**: Background `#FFFBEB`, Border `#FDE68A`, Text `#D97706` (Amber).
- **Flagged / Discrepancy**: Background `#FFF1F2`, Border `#FECDD3`, Text `#E11D48` (Rose).
- **Unassigned / Closed**: Background `#F1F5F9`, Border `#CBD5E1`, Text `#64748B` (Slate).

## Typography

The type system implements a strict dual-engine schema:

1. **Structural Prose & Controls (`Inter`)**: Utilized for navigation, headings, form labels, tooltips, dialogs, and explanatory microcopy. Configured with standard optical kerning and subtle negative tracking on sizes 14px and above to create a condensed, precise UI tone.
2. **Tabular Quantities & Identifiers (`JetBrains Mono`)**: Mandated across every financial amount, exchange rate, transaction ID, ledger hash, timestamp (ISO-8601), and delta calculation. All numbers align cleanly along tabular baselines (`font-variant-numeric: tabular-nums`).

### Type Application Rules
- Use `label-caps` strictly with CSS `text-transform: uppercase` for table column headers, status badge text, and metric card super-titles.
- Never set monetary ledger entries in Inter; negative deltas must prepend a true minus sign (`−` / `U+2212`) rather than a standard hyphen.
- Truncate long transaction hashes to `6...6` formats with an inline copy trigger, rendering exclusively in `mono-identifier`.

## Layout & Spacing

This design system uses an exact, 4px-baseline layout built for widescreen density and side-by-side transaction inspection.

### Layout Model
- **Primary Grid**: Three-pane structural shell consisting of a collapsible 240px primary navigation rail, an expansive fluid-width reconciliation viewport, and an optional 380px contextual drawer/inspector panel.
- **Data Table Grid**: Edge-to-edge tabular presentation with standard row heights:
  - **Dense Data Rows**: 36px vertical footprint, `8px` horizontal padding.
  - **Standard Rows**: 44px vertical footprint, `12px` horizontal padding.
- **Component Padding Scale**:
  - Micro-actions, badge chips, and cell tags: `2px` vertical, `6px` horizontal.
  - Form fields and compact buttons: `6px` vertical, `10px` horizontal.
  - Cards and operational panels: `16px` inner inset padding.

### Screen Adaptations
- **Desktop (>1440px)**: Default triage arrangement. Side-by-side reconciliation (e.g., Bank Feed on the left, Internal Ledger on the right) with continuous inspection sidecar.
- **Laptop (1024px - 1439px)**: Inspector collapses into an overlay drawer. Table columns collapse into high-priority financial metrics with an expandable row disclosure.
- **Tablet (<1024px)**: Navigation compresses into a compact rail (56px). Split ledgers pivot to tabbed switches.

## Elevation & Depth

Depth is established primarily through hairline borders and subtle structural tone shifting, avoiding deep drop shadows to keep the interface crisp and legible.

### Surface Levels
- **Level 0 (App Canvas)**: Solid `#F8FAFC` slate canvas.
- **Level 1 (Data Cards & Tables)**: Solid `#FFFFFF` anchored by a `1px solid #E2E8F0` border. No drop shadow.
- **Level 2 (Dropdowns, Menus, Select Overlays)**: `#FFFFFF` surface with `1px solid #E2E8F0` and an ambient, low-contrast shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs & Context Sheets)**: Centered overlay over a high-opacity backdrop blur (`rgba(15, 23, 42, 0.3) backdrop-blur-sm`) with shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`.

### Border Discipline
All interactive cards, inputs, buttons, and popovers maintain an unbroken `1px` boundary line. Never rely on color fills alone to differentiate clickable items from neutral backgrounds.

## Shapes

The interface adopts a tightly controlled, soft-radius geometric language (Level 1).

### Shape Tokens
- **Micro Elements (Badges, Status Pills, Shortcut Keys)**: `3px` or `4px` (`rounded-sm`). Badges must not appear as full pills; pill shapes diminish data density and visual alignment with tabular rows.
- **Interactive Controls (Inputs, Buttons, Dropdowns)**: `6px` (`rounded-md`). Provides a balanced, clean finish that integrates seamlessly with table cell geometry.
- **Panels & Sheet Containers (Cards, Modal Sheets)**: `8px` (`rounded-lg`). Provides subtle softness without wasting canvas area.
- **Inner-Cell Focus Rings**: `2px` offset with `4px` radius for clear keyboard accessibility.

## Components

### Buttons
- **Primary Action**: Solid `#0284C7` background, white bold text (`Inter 13px/600`), hover state `#0369A1`, active `#075985`. Height 32px, horizontal padding 12px, radius 6px.
- **Secondary / Ghost**: White background, `1px solid #E2E8F0`, text `#0F172A`. Hover: background `#F8FAFC`, border `#CBD5E1`.
- **Destructive**: Rose tint background `#FFF1F2`, border `#FECDD3`, text `#E11D48`. Hover: `#FFE4E6`.

### Data Table (Reconciliation Ledger)
- **Header**: `#F8FAFC` background, `32px` height, border-bottom `1px solid #E2E8F0`. Text formatted in `label-caps` (`#475569`).
- **Cells**: Compact vertical padding (`8px`), horizontal padding (`12px`). Border-bottom `1px solid #F1F5F9`. Hover state on entire row: `#F8FAFC`.
- **Selected Row**: Border-left `3px solid #0284C7`, background `#F0F9FF`.

### Micro Badges & Confidence Chips
- **Dimensions**: Maximum height `20px`, padding `1px 6px`. Text size `11px`, font `Inter` or `JetBrains Mono` based on content.
- **AI Match Confidence**: Deep teal surface (`#F0FDFA`), border (`#99F6E4`), text (`#0D9488`). Format: `AI: 99.4%` in `JetBrains Mono`.

### Input & Search Fields
- **Container**: Solid `#FFFFFF`, border `1px solid #CBD5E1`, text `13px Inter`.
- **Focus Ring**: Border shifts to `#0284C7` with a non-blurring ring `0 0 0 2px rgba(2, 132, 199, 0.15)`.
- **Inline Monospace Filters**: Embedded key-value pairs (e.g., `source:stripe`, `amount:>5000`) rendered as small neutral badges (`#F1F5F9`) within the input box.

### Keyboards Shortcuts (`Kbd`)
- **Container**: Crisp border `#CBD5E1`, background `#F8FAFC`, bottom shadow `0 1px 0 #CBD5E1`. Font `JetBrains Mono 10px`, text `#475569`.