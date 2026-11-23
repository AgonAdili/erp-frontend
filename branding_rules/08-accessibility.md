# 08 · Accessibility (WCAG 2.2 AA)
Most of this comes for free when the shared components are used.

## Structure
- **One `<h1>` per page**; headings go down in order (h1 → h2 → h3). Never skip a level for size; use a class instead.
- Landmarks: header, `nav[aria-label]`, `main#main`. A "Прескокни до содржината" skip link is the first Tab stop.
- `<html lang>` = the UI language. Each page has a unique title.

## Forms
- **Every field has a `<label for>`.** Radios and checkboxes sit in a `<fieldset>` with a `<legend>`.
- Errors: `aria-invalid`, a message linked by `aria-describedby`, and an error summary that receives focus on submit.
- Never disable submit to signal invalid fields: let the user submit, then show the errors.
- `autocomplete` on personal fields.

## Controls
- Real `<button>` for actions and `<a href>` for navigation, so Ctrl/⌘-click opens a new tab. No clickable `<div>`.
- **Icon-only buttons** have an `aria-label` and a matching tooltip; decorative SVGs are `aria-hidden`.
- **Targets ≥ 24 × 24px** (controls are 32px, table actions 26px; on touch 40 / 32px).
- **Visible focus everywhere** (2px brand outline). Never `outline: none` without a replacement.
- **Keyboard:** Tab order follows the visual order. Menus open with Enter or Space, arrows move, Esc closes. Dialogs trap focus and return it to the opener.

## Colour and text
- Text contrast ≥ 4.5:1. Input borders ≥ 3:1. Hairlines are decorative and exempt. Use the token pairs; don't invent new ones.
- **Minimum text size 12px.**
- **Status is never colour alone:** a chip is a dot + text; a negative amount has the `−` sign + colour; a stepper has a mark + the state's words.
- Known, accepted exception: white text on the operations orange is 3.1:1.
- **200 % zoom and 375px width cause no sideways page scroll.** Tables scroll inside their own container.

## Tables and charts
- `<th scope="col">`, and a caption that names the table (it may be visually hidden). Sortable headers are buttons with `aria-sort`.
- **Every chart** has a heading, an `aria-label` summary sentence ("Трошоците растат од 1,2 млн во јули на 1,8 млн MKD во септември") and the same data as a table.

## Live content
- Live values announce politely (`aria-live="polite"`). Every board with live updates has a **pause** control (WCAG 2.2.2), and updates stop while the tab is hidden.

## Motion
`prefers-reduced-motion` is respected (06 §4).

## Testing per page type
- axe: 0 serious or critical violations, in light and dark.
- Keyboard only: everything reachable, focus visible.
- A screen-reader pass on one form (VoiceOver), 200 % zoom, 375px.
