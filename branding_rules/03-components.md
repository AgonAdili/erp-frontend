# 03 · Components
Each part has **one** implementation, reused everywhere. Class names are the ones in `ea-fe.css`, so the existing CSS styles any markup that uses them, whether it is a Django template or a React component. The markup source of truth is the FE templates (`templates/components/`, `templates/partials/`).

## Buttons
| Variant | Use |
|---|---|
| `.btn.btn-primary` | The **one** main action of the view: Зачувај, Нов налог, the next workflow step |
| `.btn.btn-outline-secondary` | Secondary actions: Откажи, Извези, Печати |
| `.btn.btn-ghost` | Row and toolbar actions, icon buttons |
| `.btn.btn-danger` | **Only** as the confirm button inside the confirm dialog |
- Pills. 32px high (`.btn-sm` 26px, inside table rows and dense toolbars only). The label never wraps.
- Primary = ink fill (bone in dark). It keeps its colour under the pointer: one step darker, never a grey swap.
- One verb per action, app-wide: Зачувај · Откажи · Уреди · Избриши · Додај · Извези · Филтрирај · Исчисти.
- **Loading:** the label stays and a spinner sits beside it. The button can't be pressed twice. The result follows as a short "Зачувано".
- A label that changes ("Одобри" → "Одобрено") changes on the same button; never swap in a second one.
- **Delete** is never a button on a page or in a list row. It is the last item of the record's `⋯` menu, after a divider, and opens the confirm dialog.
- No emoji or symbol characters. Width fits the label: Albanian runs about 30 % longer.

## Fields
- 32px high, 6px radius, 1px `--ea-control-border` (3:1 contrast), surface fill.
- The label sits **above** the field (12px), linked with `for`/`id`. Help and error text sit below, linked with `aria-describedby`.
- Required fields carry `*`, with "* задолжително поле" once at the top of the form.
- An empty select says "Изберете…". A filter select says "Сите".
- **Dates:** a field that shows and accepts `dd.mm.yyyy` (typing `14102026` gives `14.10.2026`), never the browser's `type="date"`.
- **Money and quantities:** `inputmode="decimal"`, right-aligned, unit inside the field, formatted on leaving the field (`1.234.567`). Placeholder `0,00` or none, never `0.00`.
- On touch screens inputs are 16px, so the phone doesn't zoom. Never limit zoom.
- Every field has `name` and `autocomplete`, and `spellcheck="false"` for codes and numbers. Pasted spaces are trimmed on leaving the field.
- Honest defaults: a new record starts as Нацрт, not "Pending".

## Form footer
- Right-aligned **[Откажи] [Зачувај]**, the same in dialogs. Sticky on long forms (solid background, hairline above, no shadow).
- Save always says Зачувај. Workflow steps (Поднеси, Одобри) are separate actions on the record page.
- ⌘/Ctrl + S saves; ⌘/Ctrl + Enter submits from a textarea.
- **Leaving with unsaved changes** asks first: "Имате незачувани промени" with [Остани] [Отфрли промени].

## Page head
- An optional ancestor link ("← Работни налози"), then **the page's only `<h1>`** (32px, 400), an optional sub-line, and the actions on the right (one primary, the rest secondary, `⋯` for the rarest).
- Breadcrumbs show ancestors only, never an item that repeats its parent.
- Filters and the period picker sit under the title, never among the actions.

## Panel (card)
`section.ea-panel`: hairline outline (`--ea-line`), 10px radius, surface fill, no shadow.
- **Head:** title (`h2`, 18 / 600), optional meta (12px), optional link on the right ("Сите задршки"), hairline below.
- **Body:** 24px padding (16px on phones).
- **Quiet footer** pinned to the bottom: the source line ("Извор: …") and "Прикажи ги податоците".
- **Widths** in the 12-column grid: `s4 / s6 / s8 / s12`.
- A **table** inside a panel sits flush under the head, its first and last cells on the panel's 24px edge, with no band under the last row.

## Figures strip
`ul.ea-figures`: up to four numbers as cells of one hairline grid (one instrument, not four cards).
- **Label:** mono uppercase, links to the filtered list.
- **Value:** 26 / 600, tabular figures. It scales down so an amount and its unit stay on one line.
- **Change chip:** "↓ −6 %", coloured **by meaning, not by sign** (good / bad against the previous period).
- **Hint line,** "Во живо" only when the value refreshes live, "Отвори листа", and **"Како се чита"**: a popover with source, calculation, scope, refresh, rule, owner and how to read it.
- **Day tracker** (14 days on or off the rule) appears **only** when the figure has a daily rule.
- **Missing data** reads "нема податоци", never 0.
- Colour the number (`is-stop`, `is-go`) only when the state is the point.

## Status
- `.ea-st` = a round `.ea-dot.is-{go|info|caution|stop|neutral}` + the text.
- One mapping from status code to tone, so the same status looks the same in every module. Labels are short; who and where belong in the stepper.
- A record's overall state can be a chip (`.ea-chip.is-{tone}`): a pill with the dot and the label.

## Tables
- **Header:** solid `--ea-subtle`, 12px. **Rows:** 44px, hairline between rows, `--ea-subtle` on hover, no zebra stripes.
- **First column:** the record link (number or name, bold) with an optional sub-line.
- **Numbers:** right-aligned, tabular. A money column puts the currency in its header.
- **Status:** dot + text. An age or overdue value turns red past its rule.
- **Sortable headers** are buttons with `aria-sort`. Sorting and paging are server-side for any list longer than one page (25 rows, "Прикажани 1–25 од 312").
- Cells don't wrap unless a long-text column opts in. Wide tables scroll **inside their own container**, never the page.
- **Row selection** shows a bulk bar (export, assign, delete with a reason). The row menu `⋯` holds: quick view, open, quick edit, edit, duplicate.
- **Quick edit in a cell:** Enter saves, Esc cancels; an error shows under the cell and keeps the typed value.
- **Empty state** inside the table: "Нема записи." or, with filters active, "Нема резултати за овие филтри." + [Исчисти].
- **Totals row** under money columns where it helps.

## Lists of rows
`ol.ea-rows` (title + sub-line + state at the end), `ol.ea-due` (days left as a number, then the item and the date). Long names wrap inside the card, never widening the page.

## Dialogs
- Native `<dialog>`: focus moves in, is trapped, and returns to the opener; Esc closes.
- **Confirm dialog:**
  - the title asks the question with the object ("Да се избрише фактурата ФА-2026-0142?");
  - the body states the consequence;
  - buttons [Откажи] [Избриши фактура];
  - focus starts on Откажи;
  - with a required reason, a labelled textarea is added.
- Never `alert()`, `confirm()` or `prompt()`. Information becomes a toast; validation becomes an inline error.
- A pop-up is used **only** for a confirmation, and for a one-time "what's new" after a release (at most once per session).

## Toasts and alerts
- **Toast:**
  - bottom right (full width above the bottom nav on phones), at most 3;
  - solid status fill, white text (dark on yellow), icon, past tense ("Фактурата е зачувана.");
  - optional **Врати** (undo);
  - success and info stay 5 s, undo 8 s, errors stay until closed; the timer pauses on hover and focus.
- **Inline alert** (`.ea-alert.is-{tone}`): a solid status fill for a state that blocks work (locked period, missing statements, expiring document). `role="alert"` only for errors.
- **Announcement banner:** in the page flow above the content, never floating over it. One at a time, dismissed per user.

## Navigation parts
- **Sidebar:** grouped by module group, the module icon in its colour.
  - The current item is a solid surface; counts are pills.
  - It collapses to 64px, and on phones a bottom nav replaces it.
  - The server sends only what the user's role allows; the interface never hides links on its own.
- **Module tabs** under the top bar: Преглед first, then the module's lists.
- **View switch** (`.ea-seg`): one subject, several views (board / list, grid / table), kept in the URL (`?view=`).
- **Segmented control / slide tabs:** a grey track with an ink pill on the chosen item, which slides to it. Used for the period picker and in-page views.
- **Command palette** (⌘/Ctrl K) and **"+ Ново"** (choice tiles of what to create, filtered by permission).
- **Menus** (`details.ea-menu-d`): hairline outline, 32px items, the destructive item last after a divider. Esc and an outside click close them; only one is open at a time.

## Record page parts
- **Record toolkit** on every record: previous / next in the list ("1 од 7 во „Налози“"), follow, the status bar, comments with @mentions, and history.
- **Stepper:** done = green mark with ✓, current = ink ring, waiting = grey ring, rejected = red mark with ×. At most 7 steps.
- **Facts:** `dl.ea-kv` in 2–3 columns; the label (12px, `--ea-text-3`) sits 4–6px above its value.
- **Documents:** a list with an upload dialog (file, type, valid until).
- **Photos:** a grid that opens a lightbox (← →); on phones, adding photos uses the camera.

## States every part needs
- **Empty:** an icon, one sentence on what is missing, one action.
- **Loading:** a skeleton of the real layout with a solid pulse (no shimmer gradient), shown only after 300ms and for at least 400ms.
- **Error:** says what happened and what to do, with no apology and no codes or stack traces.
- **Permission:** an action the user can't take is absent; one they can't take *yet* is disabled with the reason.
