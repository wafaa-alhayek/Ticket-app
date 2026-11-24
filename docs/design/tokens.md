# Design tokens — دور

Source of truth: `tokens.json`. Web: expose as CSS custom properties `--dor-<path>` (e.g. `--dor-color-brand`) in the inline `<style>`; keep CSS tiny. Flutter: map into `ThemeData`/`ColorScheme` in one `dor_theme.dart`.

## Colors
| Token | Hex | Use |
|---|---|---|
| brand | #14532d | header, primary button, big numbers |
| brandDark | #0b2e1a | display screen bg |
| bg | #f4f1ea | page bg (warm off-white) |
| surface | #ffffff | cards, inputs |
| surfaceAlt | #e7e2d6 | secondary buttons |
| text | #1d1d1b | body text |
| textMuted | #5c5648 | hints, meta (**changed** from #6b6556) |
| border / borderInput | #ddd6c8 / #8a8373 | card border (decorative) / input border (**changed** from #b9b2a3 = 2.11:1, fails) |
| danger | #9a3412 | destructive buttons |
| focus | #1d4ed8 | 3 px outline |
| display.number | #facc15 | number on display screen |

Status (bg / fg / border): waiting `#dbeafe/#1e3a8a/#3b82f6` · near `#fef3c7/#78350f/#f59e0b` · called & ready `#dcfce7/#14532d/#16a34a` · done & offline `#e7e2d6/#1d1d1b/#8a8373` · missed & error `#fee2e2/#7f1d1d/#dc2626`.
Status is never colour-only: always a text label + (optional) icon.

### Contrast (WCAG 2.1, computed)
| Pair | Ratio | Result |
|---|---|---|
| text on bg | 14.97 | AAA |
| text on surface | 16.88 | AAA |
| textMuted on bg / surface | 6.46 / 7.29 | AA (AAA on white) |
| white on brand (buttons, header) | 9.11 | AAA |
| brand on bg | 8.08 | AAA |
| white on danger | 7.31 | AAA |
| text on surfaceAlt | 13.06 | AAA |
| waiting fg/bg | 8.49 | AAA |
| near fg/bg | 8.15 | AAA |
| called fg/bg | 8.30 | AAA |
| missed/error fg/bg | 8.20 | AAA |
| display number on brandDark | 9.66 | AAA |
| white on brandDark | 14.79 | AAA |
| borderInput on white (non-text) | 3.77 | ≥3:1 pass |
| focus on white / bg | 6.70 / 5.94 | pass |
| status borders on white: called 3.30, waiting 3.68, error 4.83 | — | pass; near border #f59e0b 2.15 is decorative only (meaning carried by bg + text) |
| old textMuted #6b6556 on bg | 5.14 | passes, but replaced for margin on dim screens |

## Type
System fonts only (no web fonts — bandwidth). Body **17 px**, line-height 1.6.
| Token | px | Use |
|---|---|---|
| small | 15 | legal/meta only, never essential info |
| body / label | 17 | everything else |
| button / buttonBig | 18 / 21 | |
| h2 / h1 | 20 / 24 | |
| ticketNumber | 76 | ticket & dashboard number |
| displayNumber | 150 | display screen (use `min(150px, 30vw)`) |
Use Western digits (0-9) everywhere (NFR-3). Numbers in bold.

## Spacing, radius, size
- space: 4 · 8 · 12 · 16 · 24 · 32 (page gutter 16).
- radius: 6 · 8 (buttons/inputs) · 10 (cards).
- touchTarget **48 px** min height/width, 8 px gap between targets; inputs 48 px; big buttons 56 px full width.
- content max width 720 px.
- No animation. Flutter page transitions ≤150 ms or none.
