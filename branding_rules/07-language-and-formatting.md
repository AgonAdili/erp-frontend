# 07 · Language and formatting

## 1 · Three languages
- **Macedonian (default), Albanian, English.** Every string the interface shows goes through translation once (Django i18n in templates; the shared catalogue in the front end, keyed by the Macedonian text). Never hard-code a label.
- **Albanian is a draft** until a native-speaking staff member has reviewed every string.
- The language is a user setting (profile), switched in the user menu by name (Македонски · Shqip · English), never by flags. `<html lang>` follows it.
- **What changes with the language:** every label, message, button, menu, tooltip, empty state and e-mail.
- **What does not change:** numbers, money, dates, record numbers, and people's and companies' names. Names in data are transliterated where needed (ФК-00215 → FK-00215), never translated.
- Status values are stored as codes and translated on display. Never build a sentence by joining a noun and a status label; write the full sentence as its own string.

## 2 · Copy
- **Sentence case everywhere,** in all three languages: "Нов работен налог", not "Нов Работен Налог". Macedonian and Albanian month names are lowercase.
- **Tab title:** `Наслов — EACore`; on records, `ФА-2026-0142 — Фактури — EACore`. The `<h1>` matches the first part.
- **Buttons** are an imperative verb (+ object): "Одобри налог", not "Submit". The same verb runs through the flow: the button says "Испрати", the toast says "Испратено".
- **Toasts** are past tense: "Фактурата е зачувана."
- **Errors** say what happened and what to do: "Датумот на доспевање е пред датумот на фактурата. Внесете подоцнежен датум." No apology, no blame, no codes or English stack text.
- **Empty states** invite the next action.
- **Missing data** reads "нема податоци", never 0.
- Avoid addressing the user where you can ("Нема понуди", not "Вие немате понуди").
- Use one term per concept, from the glossary, everywhere.
- Use the ellipsis character `…`, never `...`. Macedonian quotes are „…“.
- A non-breaking space goes between a number and its unit (`1.234 MKD`, `12 t`).

**Core terms:**
| EN | MK | SQ (draft) |
|---|---|---|
| Save · Cancel · Edit · Delete · Add | Зачувај · Откажи · Уреди · Избриши · Додај | Ruaj · Anulo · Ndrysho · Fshi · Shto |
| Filter · Clear filters · Export · Print | Филтрирај · Исчисти филтри · Извези · Печати | Filtro · Pastro filtrat · Eksporto · Printo |
| All · Search… · More actions · Overview | Сите · Пребарај… · Повеќе акции · Преглед | Të gjitha · Kërko… · Më shumë veprime · Pasqyra |
| Undo · Back · Close · Confirm | Врати · Назад · Затвори · Потврди | Kthe · Kthehu · Mbyll · Konfirmo |

**Statuses** (code → MK / tone):
| Code | MK | Tone |
|---|---|---|
| `draft` | Нацрт | neutral |
| `submitted` | Поднесено | info |
| `pending_approval` | Чека одобрување | caution |
| `approved` | Одобрено | go |
| `rejected` | Одбиено | stop |
| `in_progress` | Во тек | info |
| `completed` | Завршено | go |
| `cancelled` | Откажано | neutral |
| `paid` / `partially_paid` / `unpaid` | Платено / Делумно платено / Неплатено | go / caution / neutral |
| `overdue` | Задоцнето | stop |

## 3 · Money
The same format in every UI language. It is a company convention, not tied to the locale.
| Case | Output |
|---|---|
| Documents, invoices, records, forms | `1.234.567,00 MKD` |
| Dashboards, summaries, figures | `4.323.263 MKD` (whole numbers) |
| Euro | `12.500,00 EUR` |
| Negative | `−4.323.263,00 MKD` (U+2212 minus, in the stop colour) |
| Empty | `—` |
| Single-currency table column | `1.234.567,00`, with "(MKD)" in the header |
| Very large, in a narrow figure | `1,21 млрд MKD`, with the full value in `title` |

- **The ISO code goes after the amount.** Never `ден`, `ден.`, `МКД` or `€`. The currency comes from the record, never hard-coded.
- Thousands `.`, decimals `,`, a non-breaking space before the code.
- Short forms only from one million up: млн / млрд (MK), mln / mld (SQ), M / bn (EN).

## 4 · Numbers
- Integers `1.234`; with decimals `1.234,50`. Percent `12,5 %` (a space before %).
- **Quantities:** fixed decimals per unit (pieces 0, litres 2, m² 2, tonnes 3).
- Units come after a non-breaking space: `12.450 km`, `38,5 l`, `24 ч`.

## 5 · Dates and time
| Case | Output |
|---|---|
| Date | `08.10.2026` |
| Date + time | `08.10.2026 14:30` (24-hour, Europe/Skopje) |
| Month heading | `октомври 2026` (lowercase in MK and SQ) |
| Relative (feeds, "updated" only) | `пред 6 дена`, up to 7 days; older entries show the date |
- A future date is never relative.
- Every relative time carries the exact value in `<time datetime=… title="08.10.2026 14:30">`.
- Inputs accept `1.234,50` and `1234.50`, and show the value back in the canonical format.

## 6 · Data passed to scripts
Never print values into a `<script>`. Pass data as JSON (`json_script`, or the page's JSON endpoint), which always uses plain numbers (`7290.7`) whatever the locale.
