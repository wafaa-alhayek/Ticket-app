# دور — Brand sheet

Motif: a queue **ticket** (side notches + perforation). The yellow dot on the stub is "your turn".
The Arabic wordmark «دور» is converted to outlines (DejaVu Sans Bold, shaped with HarfBuzz,
exported with fontTools), so logo and icon render with **no fonts installed**.

## Palette
| Name | Hex | Use |
|---|---|---|
| Deep green | `#14532d` | Primary: wordmark, ticket, headers, buttons |
| Accent yellow | `#facc15` | Accent only: "turn" dot, icon ticket, highlights. Never for text on white |
| Warm off-white | `#f4f1ea` | Backgrounds, text on green |
| Ink | `#111111` | Body text on poster / print |

Contrast: off-white on green ≈ 8.9:1; green on yellow ≈ 6.4:1; both pass WCAG AA.

## Files
| File | What |
|---|---|
| `logo.svg` | Horizontal logo (RTL: symbol right, wordmark left), for light backgrounds |
| `logo-inverse.svg` | Horizontal logo on green tile, yellow ticket |
| `logo-mark.svg` | Symbol only (ticket) |
| `icon-background.svg` | Android adaptive icon background, 108dp canvas (solid green) |
| `icon-foreground.svg` | Adaptive foreground, content inside 66dp safe zone (x/y 21–87) |
| `icon-full.svg` / `icon-512.png` | Flattened icon (store listing / PWA) |
| `favicon.svg` | 312-byte favicon, ticket only, legible at 16 px |
| `poster-a4.svg` | Printable A4 store poster template |
| `previews/` | PNG renders (Playwright/Chromium), incl. B&W poster and icon mask check |

## Poster template
Replace placeholders as plain string substitution:
- `{{STORE_NAME}}` – store name (inside `<g id="store">`)
- `{{CODE}}` – store code
- `<g id="qr">` – 100×100 mm area at x=55, y=112 (mm). Replace its children with the QR (`<path>`/`<image>`), keep quiet zone white.

Poster text is live `<text>` (so it can be edited/localised) with the stack
`Noto Kufi Arabic, Noto Naskh Arabic, Tahoma, DejaVu Sans, Arial`; the header wordmark is outlines.
It is designed to print in black & white: dark green prints as dark grey, yellow only appears
as a fill with dark outlines, and the "no phone" line is white on black.

## Usage rules
- Keep clear space around the logo ≥ the height of the yellow dot ×2.
- Do not recolour the wordmark except green / off-white; do not stretch, rotate or add effects.
- Minimum size: logo 96 px wide; below 32 px use `favicon.svg`/`logo-mark.svg` instead.
- Use yellow sparingly — one accent per screen.

## Regenerating
The SVGs are hand-structured; wordmark path came from:
`hb-shape` (uharfbuzz) + `fontTools` `SVGPathPen` on `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf` (Bitstream Vera / DejaVu free licence).
