# Accessibility checklist — دور

Check every screen before Review (web and Flutter).

## Language & direction
- [ ] `<html lang="ar" dir="rtl">`; Flutter `locale: ar`, `Directionality.rtl`.
- [ ] Codes, usernames, passwords, URLs, phone inputs use `dir="ltr"` (Flutter `TextDirection.ltr`).
- [ ] Western digits; numbers are real text (not images).

## Visual
- [ ] Body ≥ 17 px; nothing essential below 15 px; works at 200% zoom / Android large font without horizontal scroll at 360 px.
- [ ] Text contrast ≥ 4.5:1, large text/UI borders ≥ 3:1 (see tokens.md table). Use `borderInput` #8a8373 for inputs.
- [ ] Status never by colour alone: label text always present (في الانتظار / حان دورك!).
- [ ] Visible focus: 3 px `focus` outline on all buttons, links, inputs.
- [ ] No animation, flashing or auto-scrolling.

## Touch & input
- [ ] All targets ≥ 48×48 px, ≥ 8 px apart. Primary actions full width.
- [ ] Destructive actions (cancel, reset, delete) separated from primary and require confirmation.
- [ ] `inputmode="tel"` for phone, `numeric` for qty; `autocomplete` set for login.
- [ ] Every input has a visible `<label for>` (not placeholder-only).
- [ ] Errors shown in text near the top in a notice with `role="alert"`, keep user input.

## Screen readers (TalkBack)
- [ ] Headings in order (one h1 per page).
- [ ] Ticket number announced with context: wrap as "رقمك 53" (visually-hidden prefix / Flutter `Semantics(label:)`).
- [ ] Status region `aria-live="polite"` on ticket/order (helps when JS-enhanced; harmless without).
- [ ] Decorative emojis `aria-hidden="true"`; icon-only buttons have labels.
- [ ] Tables have `<th>`.

## Low-bandwidth / low-end as accessibility
- [ ] Works with no JS, images off, and on KaiOS keypad (logical tab order).
- [ ] Page ≤ 15 KB gzipped; no web fonts.
- [ ] Refresh doesn't move buttons or lose focus position of the primary action.
- [ ] Last-update time visible on auto-refreshing pages.
- [ ] Display screen readable from 5 m (number ≥ 150 px on TV), high contrast dark theme.

## No-phone users
- [ ] Paper ticket path exists for every line; operator button visible without scrolling on the line card.
- [ ] Display screen + spoken calling cover people who cannot read the screen; operator says number aloud.
