# 01 · Principles

## 1 · Eight rules that apply to every screen
1. **Solid colours, negative space.**
   - No gradients, tinted or pastel backgrounds, translucent fills, shadows or glows.
   - Separate with space first, a 1px hairline second, a solid neutral fill last.
   - The only exception is the modal scrim behind a dialog.
2. **Colour means something.** Ink and greys carry the page. Colour appears only for a status, a module group or a judged value (a red point that breaks a rule). Never as decoration.
3. **No raw values.** Colours, sizes, radii and durations come from `tokens.css`. No hex or px values in templates or components. An inline `style` may only set a custom property the CSS reads (`--v`, `--s`, `--w`, `--x`).
4. **No raw strings.** Every label goes through translation (07). Status values are stored as codes and translated on display.
5. **No raw numbers or dates.** Money, numbers and dates use the shared formatters (07), never ad-hoc formatting.
6. **One of each.** One button component, one input height, one confirm dialog, one page head with one `<h1>`, one icon set, one chart approach. No UI kit (Bootstrap JS, MUI, shadcn, Ant). Pasted third-party components are patterns only: rebuild them on EACore classes.
7. **Every number leads somewhere.** A figure, count or bar links to the list with the same filter (`?status=…&from=…`). Every widget has a way out.
8. **Every page passes 09** in MK, light and dark, at desktop and phone width.

## 2 · Who it is for
About 150 people use EACore all day: office staff on monitors, site managers on laptops in a site container, drivers and mechanics on phones. Design for speed and fewer errors:
- show exceptions, not everything;
- one board serves one role's daily meeting;
- each widget answers one question and leads to one action.

## 3 · Confidentiality and dummy data
EACore holds EA Group's real finance, HR and partner data.
- **Never** put real names, salaries, personal IDs, partner names, tax numbers, IBANs, invoice numbers, project names, ledger amounts or vehicle plates in a mockup, fixture, test, screenshot, Storybook story or prompt.
- Don't upload EACore code, data or screenshots to outside services or AI tools, and keep repositories private.

**Dummy data that looks real** (it must stress the layout the way real data will):
| Field | Pattern | Example |
|---|---|---|
| People | Mixed Macedonian and Albanian names, varied lengths | Ана Петровска, Arben Rexhepi, Марија Стојановска-Николовска |
| Companies | Start with „Демо“ / „Demo“, with a legal suffix | Демо Градба Север ДООЕЛ, Demo Ndërtim DOO |
| Tax number (EDB) | `4000999` + 6 digits | 4000999123456 |
| IBAN | `MK07 999…` (bank code 999 doesn't exist) | MK07 9990 0000 0012 345 |
| Records | Type prefix, year, number | ФА-2026-0142, РН-2026-0412 |
| Plates | Fictional city code `XX` | XX-1234-AB |
| Amounts | Varied sizes, decimals, a few negatives, one very large | 7.290,70 · −1.500,50 · 1.211.574.301,00 MKD |
| Dates | Past 18 months; only due and planned dates may be in the future | — |
| Text | One very long description per list | — |

**Seed data:**
- Counts vary, and at least one is zero, to test empty states.
- Every status appears at least once.
- There is one user per role.
- No future-dated transactions.
- The seed script is in the repository, so screenshots can be reproduced.

## 4 · Names
"EA Group", "EACore", "Microsoft 365" and "Google Maps" are names. They are never translated (never "ЕА Груп") and carry `translate="no"`.
