# 09 · Quality checks (definition of done)
A page is done only when every item passes **in MK, light and dark, at 1440px and 375px** (spot-check EN and SQ, which run longer).

## Structure and copy
- [ ] It is one of the five page types (04 §3) and uses the shared page head
- [ ] Exactly one `<h1>`; tab title = "h1 — EACore"; `<html lang>` correct
- [ ] No English in the MK interface (validation errors, toasts, empty states and tooltips included)
- [ ] Sentence case; glossary terms only (07)

## Components
- [ ] Only the shared button variants; heights 32 (26 in rows); one primary per view; no emoji
- [ ] Inputs 32px; every field labelled; "Изберете…" in empty selects; dates `dd.mm.yyyy`; no `0.00` placeholder
- [ ] Form footer [Откажи] [Зачувај]; unsaved-changes guard
- [ ] No `alert` / `confirm` / `prompt`; no delete in list rows
- [ ] Status as dot + text everywhere
- [ ] Icons only from the Solar "-linear" sprite

## Formatting
- [ ] Money, numbers and dates only through the shared formatters (07); MKD / EUR after the amount
- [ ] Numbers right-aligned with tabular figures
- [ ] No values printed into scripts

## Look
- [ ] **Solid colours only:** no gradients, tints, translucent fills or shadows (the modal scrim excepted)
- [ ] Only token values; inline `style` sets custom properties only
- [ ] Colour use matches 02: module colour only for the module, status colour only for a status
- [ ] Works in dark mode with no page-specific dark CSS
- [ ] No third-party network requests (fonts, icons and libraries are self-hosted; Google Maps on map pages only)

## Layout (measured, not eyeballed)
- [ ] **No sideways page scroll** at 1280 and 390
- [ ] **No card more than 40 % empty** because of its row neighbour
- [ ] Every grid row adds up to 12
- [ ] No control too small for its content; nothing cut by its container (tables scroll inside theirs)
- [ ] Words keep 12px or more from a card's edge; a field and the button under it are 8px or more apart; a label and its value 4–6px of ink apart
- [ ] Nothing floats over content (banners in the flow; toasts bottom right)

## States
- [ ] Empty, no-results, loading (skeleton) and error states designed and translated
- [ ] Impossible actions absent; not-yet actions disabled with a reason

## Accessibility (08)
- [ ] axe: 0 serious or critical, in light and dark
- [ ] Keyboard only; focus visible; dialogs trap and return focus
- [ ] 200 % zoom without sideways scroll

## How to measure
1. **The grader** runs Stageshow's layout checks (`film-checks.mjs`, `layout-core.mjs`) on every page, plus sideways scroll and half-empty cards: `SS=<a Stageshow copy with npm install> node FE/_build/checks/grade.mjs --all`. Target: **0 `h-scroll`, 0 `dead card`, 0 `layout`**. Other lines are candidates; look at each in a screenshot before acting on it.
2. **Accessibility:** `FE/_build/checks/a11y.js` on each page type, in light and dark.
3. **Project checks:** `layout.py`, `static_check.py`, `parity.py` (expect `{}`) and `dead.py` (no dead buttons or links) on the built pages.
4. **By eye:** compare with the FE preview page for the same route at both widths and themes. Ask:
   - what does the eye land on first, and is it the point of the page?
   - is anything covered, cut or floating?
