# 04 · Layout and pages

## 1 · The app shell
```
skip link · sidebar · [ top bar · module tabs · main#main [ banner · view switch · page ] ]
bottom nav (phones) · command palette · "+ Ново" · notifications · profile · module guide · "За страницата"
```
- The page and its direct children set `min-width: 0`, so a wide table can never stretch the page sideways.
- Content width: up to 1440px. On phones under 640px, a bottom nav replaces the sidebar, and inside records a sliding panel replaces the ancestor link.
- **Notifications, one policy:**
  - toast = the result of *my* action;
  - banner = something broken or blocked for many people;
  - bell + feed = what others did that concerns me (at most "99+");
  - dialog = confirmations only.

## 2 · The grid
- `.ea-grid-12`: cards are `s4 / s6 / s8 / s12`, and **every row adds up to 12** (the server packs it). One column under 960px.
- A tall card may span 2 or 3 rows (`ea-tall-2/3`), with short cards stacked beside it. That way a short card is never stretched to a tall neighbour's height.
- **Rule:** no card may be more than 40 % empty because of its row. If it is, the row changes (both cards full width, or a different partner).
- **Three layers, each separated its own way:**
  1. **page:** paper canvas, the title;
  2. **section:** a numbered heading (mono "01") + title 20–26px + a 2px ink rule, 32px above;
  3. **card:** a hairline-outlined sheet, 16px gutters.

## 3 · The five page types
Every page is one of these; a fix lands once.

### Board (every module opens on it)
In this order:
1. **Board bar:** period (Недела · Месец · Квартал · Година), company, "Ажурирано пред …", Прилагоди, the one create action.
2. **Greeting:** date, module title, urgency bubbles (number + 2–4 words, each opening its filtered list), the daily goal when on.
3. **Figures strip:** up to 4.
4. **Module chips:** the submodules.
5. **Sections, always in this order:**
   - **Што бара акција:** queues, due dates, items waiting;
   - **Тек и состојба:** charts against target;
   - **Каде:** maps and photos;
   - **Листи и детали:** tables and facts.
6. **Bottom row:** today, calendar, reminders, feed.

The module's **signature widget** is the first card. **Прилагоди** lets a user move, resize and hide widgets, saved per user; the server applies the saved layout when it packs.

### List
1. Page head: Извези + the create button.
2. Context bar when opened from a figure ("Отворено од „…“ · Филтер: … · Сите записи").
3. Status overview: counts per status; a click filters.
4. Filter form: search + 1–3 selects + [Филтрирај] [Исчисти], all kept in the URL.
5. The table, with its count in the panel head.
6. Pagination.

### Record
1. Page head: status chip, Следи, Уреди, ⋯, and **the one main action for the current step** (Одобри налог, Евидентирај плаќање).
2. Record toolkit: previous / next and follow.
3. **Two independent columns:**
   - wide: facts, the record's sections, comments and history;
   - narrow: next steps, documents.

   Each column stacks its own cards, so a short card never stretches.
4. For a decision (approve, return), the facts that matter (budget left, matrix row, risks) sit **above** the buttons. "Врати" (return) requires a comment.

### Form
- One column, at most 640px, grouped into titled sections.
- Required-field note at the top, error summary on a failed submit, sticky footer.
- Create and edit share one form; the title changes ("Нова банка" / "Уреди: …").
- When opened from a record or board, prefill what the system knows (project, date, crew).

### Report
Period and filter controls, then figures and a packed grid of panels, the same parts as a board. Export uses the same filters.

## 4 · URLs
- Everything a user can set is in the URL: filters, tabs, view, period, page number, and `from=` (where the user came from). Reload, Back and a shared link show the same view.
- Every number on a board links to the list **with the same filter** that produced it.

## 5 · Record pages one level deeper
- A document tile (Предмер, Градежен дневник, Ситуации) opens its own page with its own URL and an ancestor link.
- Photos open full screen with ← →.

## 6 · Maps
- Map pages use the Google Maps JavaScript API with a restricted key (the only outside host allowed, and only on map pages): list on the left, map on the right, round pins in the module colour.
- Without a key or network, the page shows the list with addresses only.
- Live vehicle positions need the approvals named by IT and HR.
