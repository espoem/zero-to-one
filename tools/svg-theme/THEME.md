# Zero-to-One Editorial Paper SVG Design System (Variant A)

This document defines the canonical static SVG theme and component grammar for `zero-to-one`, locked after comparing 4 directions (`Editorial Paper`, `Swiss Blueprint`, `Adaptive Minimal`, `Schematic Plate`).

## 1. Design Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--bg-paper` | `#FAF8F5` | Warm archival canvas background (`rx="4"`, border `#E7E2D8`) |
| `--bg-surface` | `#FFFFFF` | Primary trust/store card or panel surface |
| `--bg-subtle` | `#F5F1E8` | Warm stone fill for bars, muted tracks, secondary blocks |
| `--ink-primary` | `#1C1917` | Headings, rules, primary borders, primary arrows |
| `--ink-body` | `#44403C` | Standard diagram copy and annotations |
| `--ink-muted` | `#57534E` | Subtitles, secondary notes, muted labels |
| `--ink-caption` | `#78716C` | Uppercase mono kickers, arXiv/RFC citations, arrow verb labels |
| `--rule-strong` | `#D6D0C4` | Section dividers and secondary container strokes |
| `--rule-hairline` | `#E7E2D8` | Canvas border and footer hairline |
| `--accent-teal` | `#0F766E` | Primary safe/store/active signal (`tint`: `#F0FDF9`, `border`: `#99F6E4`) |
| `--accent-amber` | `#B45309` | Secondary gate/attention/boundary (`dark`: `#92400E`, `tint`: `#FFFBEB`, `border`: `#FDE68A`) |
| `--accent-danger` | `#DC2626` | Traps, dual-write hazards, attack vectors (`dark`: `#991B1B`/`#7F1D1D`, `tint`: `#FEF2F2`) |

## 2. Typography Stack

- **Display Title**: `Georgia, "Times New Roman", serif`, `18–20px`, weight `700`, `#1C1917`. **Headerless** above a `1.2px` `#1C1917` horizontal rule (never wrap headers inside heavy dark `#0F172A` banner rectangles).
- **Kicker / Section Index**: `ui-monospace, SFMono-Regular, Menlo, monospace`, `10–10.5px`, weight `700`, uppercase with `letter-spacing="1"` to `"1.4"`.
- **Body / Node Heading**: `ui-sans-serif, system-ui, -apple-system, sans-serif`, `11–13px` (headings bold `#1C1917`, body `#44403C`).
- **Math / Identifiers / Verbs**: `ui-monospace, SFMono-Regular, Menlo, monospace`, `9.5–11px`.

## 3. Component Grammar & Purposeful Motion Policy

1. **Purposeful, Non-Colliding Motion**:
   - Reference catalogs, taxonomy matrices, and static architecture comparisons remain static.
   - Multi-step pipelines, agent loops, state transitions, and packet-flow lanes may use calm, non-colliding CSS `@keyframes` (sequential border/stroke accent rings or mutually exclusive state frames) or bounded SMIL `<animateMotion>` along dedicated connector lanes.
   - Strictly forbidden: distracting pulsing, blinking, or glowing chrome (`pulse`, `badge-pulse`, `blink`, `glow`, `throb`, `shake`, `bounce`), marching-ant arrow noise (`dash-flow`, `flowDash`, `dash`), or moving elements crossing over text.
   - Every CSS-animated SVG MUST include `@media (prefers-reduced-motion: reduce)` settling cleanly onto a readable static state.
2. **Tufte Rule Economy**: Prefer hairline underlines (`1.2px` `#1C1917` or `#0F766E`/`#B45309`) and spatial grouping over stacked colored card borders; reserve filled borders (`#FFFFFF` / `#F0FDF9` / `#FFFBEB` / `#FEF2F2`, `rx="3"–"4"`) for distinct trust boundaries, persistent stores, and hazard callouts.
3. **Verb Connectors**: Use `1.2px` crisp open or triangle arrowheads (`#1C1917` or `#0F766E`) with short monospace verbs placed cleanly above the connector midpoint.
4. **Overflow Margin**: Always leave at least `12px` inner horizontal padding inside any bordered box so browser font metrics (`Georgia`, system sans/mono) never collide with box borders.
