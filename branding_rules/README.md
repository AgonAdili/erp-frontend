# EACore guidelines (CORE v6.9 · FE v3.8 · 12.11.2026)
**Confidential, internal to EA Group.** Every example uses dummy data (see 01 §3).

These files are the rules for building the EACore interface, in whatever stack: Django templates today, React + TypeScript next.
They replace the history in the older CORE and FE documents. **Where an older document disagrees, these files win.**

| File | What it settles |
|---|---|
| `01-principles.md` | The rules that apply everywhere, confidentiality, dummy data |
| `02-foundations.md` | Colour, type, spacing, shape, icons, themes, every token |
| `03-components.md` | One implementation of each part: buttons, fields, tables, panels, figures, status, dialogs, toasts, menus, tabs |
| `04-layout-and-pages.md` | The app shell, the grid, the five page types, boards, records, lists, forms |
| `05-data-visualisation.md` | Which chart answers which question, figures, colours in charts |
| `06-motion.md` | Durations, what moves, what never moves |
| `07-language-and-formatting.md` | MK / SQ / EN, copy, money, numbers, dates |
| `08-accessibility.md` | WCAG 2.2 AA rules for EACore |
| `09-quality-checks.md` | Definition of done per page, and how to grade it |

**Reading order:** 01, then whichever file your task needs. Check 09 before you call a page done.

**Source of values:** `tokens.css` (`--ea-*`) is the only place raw values live. If this text and `tokens.css` disagree, `tokens.css` is right and this text needs fixing: tell Mia.

**Questions and changes:** a rule changes only through Mia. Don't change a rule silently in code; ask first.
