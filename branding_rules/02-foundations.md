# 02 · Foundations

## 1 · The look in one line
A construction company's **drawing sheet**: ink on warm paper (bone on warm graphite in dark), a fine hairline grid, short mono labels and numbered sections, and colour only where it means something.

## 2 · Colour
**Brand = ink.** `#11131A` in light, bone `#E3DCC8` in dark. Used for primary buttons, links, focus, the chosen tab, today, and the main chart series. There is no violet, no navy and no separate accent hue.

**Neutrals:** canvas warm paper `#F7F6F2`, panels white `#FFFFFF`, chrome (sidebar, top bar) `#F2F0EA`, hairlines `#E2DED3`. Dark theme = **warm graphite**: page `#0D0D0D`, panels `#141414`, chrome `#0A0A0A`, bone text.

**Status (Google convention):**
| Meaning | Colour | Use |
|---|---|---|
| Good, done, approved, paid | green `#188038` | dot, text, fill |
| Information, submitted, in progress | blue `#1967D2` | dot, text, fill |
| Attention, waiting, due soon | yellow `#F9AB00` as a fill or dot, **always with dark text**; `#A35800` as text | dot, fill; text in the dark tone |
| Problem, rejected, overdue, error | red `#C5221F` | dot, text, fill |
| Inactive, draft, cancelled | grey `#5F6368` | dot, text, fill |

- A status is always a **round dot + text**, never colour alone and never another shape.
- Notifications (toasts, alerts) use the solid status fill with white text; yellow takes dark text.
- **Signal scale (three levels):** good, needs improvement, poor, always named in words.

**Module groups (three colours):**
| Group | Colour | Modules |
|---|---|---|
| Оператива и луѓе | orange `#E8710A` | Projects, Work orders, Warehouse, HR, Fleet, Quality and H&S, Delivery and transport, Plant and tools |
| Финансии и комерција | green `#188038` | Finance, Accounting, Offers, Procurement, Sales (CRM), Tenders, Guarantees and retentions, Group and consolidation |
| Податоци и анализа | blue `#1967D2` | Analytics, Archive, Partners, Master data, Legal and compliance |

- `data-module="…"` on the page sets `--ea-mod` for everything inside.
- A module icon is coloured at rest. When current or selected, the whole tile fills solid and the icon becomes negative space (white).
- A solid fill marks **one** choice only. With several selected at once, use an edge and a check.
- Text and icons on every module fill are white. White on orange is 3.1:1, an accepted, logged exception.
- Module colours never stand in for status, and status colours never decorate.

## 3 · Type
- **Inter** 400 / 500 / 600 for all text; **IBM Plex Mono** 400 for codes, units and short labels. Both are self-hosted (OFL); load nothing from a font host. Weight 300 and 700 are not used.
- **Sizes:** 12 · 14 · 18 · 20 · 26, plus display 32 (page title) and 40 (the greeting, one per page). Display drops to 26 / 32 under 768px. Body text is 14px; nothing is under 12px.
- **Tracking:** display −0.025em, titles −0.01em, mono labels +0.08em.
- **Mono uppercase labels:** 12px, `--ea-text-3`, one or two words at most. Never for sentences, buttons or anything read closely. Everything else is sentence case.
- **Codes are mono:** record numbers, EDB, IBAN, plates, units (`.ea-id`).
- **Numbers:** tabular figures in tables and figures.

## 4 · Space
- 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Page padding 32px. 40px between sections, 24px inside panels, 12px between related items, 16px grid gutters (20px from 1440px wide).
- On phones: 16px page and panel padding, 32px between sections.
- App shell: sidebar 248px (collapses to 64px), top bar 56px.

## 5 · Shape
- **Rounded rectangles and circles only.** No hexagons, diamonds, triangles or squares as status marks.
- **Radii:** inputs, menus and tooltips 6px · panels and dialogs 10px · buttons, tabs, chips, dots and avatars fully round (pills).
- **Controls:** 32px high (26px for actions inside table rows). On touch screens they grow to 40 / 32px.

## 6 · Icons
- **Solar "-linear"** (outline), self-hosted as one SVG sprite. One set only; no inline one-off SVGs, no other icon libraries.
- Sizes: 16px in controls, 14px in small buttons, 20px in navigation, 24px in empty states.
- Decorative icons are `aria-hidden`; icon-only buttons need an `aria-label`.
- No emoji in the interface.
- Licence: Solar Icons by 480 Design, CC BY 4.0. Credit them once (licences page or `THIRD_PARTY.md`).

## 7 · Themes
- The theme is an account or role setting: `light | dark | system`. `system` follows the device.
- It is set as `data-theme` on `<html>`, and the CSS handles all three. Components never carry page-specific dark CSS.

## 8 · Focus
Focus is a solid 2px brand outline with a 2px offset (`--ea-focus`), never a glow or shadow.

## 9 · All tokens (`tokens.css`)
Use them as `var(--ea-…)`. "=" means the dark value is the same.

| Token | Light | Dark |
|---|---|---|
| `--ea-bg` | `#F7F6F2` | `#0D0D0D` |
| `--ea-surface` | `#FFFFFF` | `#141414` |
| `--ea-subtle` | `#EFEDE7` | `#1C1C1C` |
| `--ea-line` | `#E2DED3` | `#262626` |
| `--ea-line-strong` | `#CBC5B6` | `#3A3A3A` |
| `--ea-control-border` | `#8C877A` | `#6E6A60` |
| `--ea-text` | `#11131A` | `#E3DCC8` |
| `--ea-text-2` | `#4A4D57` | `#A79F8C` |
| `--ea-text-3` | `#61646E` | `#8F8875` |
| `--ea-brand` | `#11131A` | `#E3DCC8` |
| `--ea-brand-hover` | `#2B2E38` | `#F1ECDF` |
| `--ea-brand-strong` | `#11131A` | `#E3DCC8` |
| `--ea-on-brand` | `#FFFFFF` | `#0D0D0D` |
| `--ea-accent` | `#11131A` | `#E3DCC8` |
| `--ea-go` | `#188038` | `#6FD39B` |
| `--ea-info` | `#1967D2` | `#8AB4F8` |
| `--ea-caution` | `#A35800` | `#FDD663` |
| `--ea-stop` | `#C5221F` | `#F28B82` |
| `--ea-neutral` | `#5F6368` | `#9AA0A6` |
| `--ea-yellow` | `#F9AB00` | `=` |
| `--ea-on-yellow` | `#202124` | `=` |
| `--ea-stop-fill` | `#C5221F` | `=` |
| `--ea-fill-neutral` | `#5F6368` | `=` |
| `--ea-stop-fill-hover` | `#A50E0E` | `=` |
| `--ea-group-ops` | `#E8710A` | `=` |
| `--ea-group-fin` | `#188038` | `=` |
| `--ea-group-data` | `#1967D2` | `=` |
| `--ea-group-ops-ink` | `#B45300` | `#FCAD70` |
| `--ea-group-fin-ink` | `#188038` | `#81C995` |
| `--ea-group-data-ink` | `#1967D2` | `#8AB4F8` |
| `--ea-signal-good` | `#188038` | `=` |
| `--ea-signal-mid` | `#F9AB00` | `=` |
| `--ea-signal-poor` | `#C5221F` | `=` |
| `--ea-heat-0` | `#EBEDF0` | `#1C1C1C` |
| `--ea-heat-1` | `#9BE9A8` | `#0E4429` |
| `--ea-heat-2` | `#40C463` | `#006D32` |
| `--ea-heat-3` | `#30A14E` | `#26A641` |
| `--ea-heat-4` | `#216E39` | `#39D353` |
| `--ea-chart-1` | `#11131A` | `#E3DCC8` |
| `--ea-chart-2` | `#8C877A` | `#8F8875` |
| `--ea-chart-3` | `#1967D2` | `#8AB4F8` |
| `--ea-chart-4` | `#CFCABD` | `#3A3A3A` |
| `--ea-font` | `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | `=` |
| `--ea-font-mono` | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` | `=` |
| `--ea-fs-12` | `0.75rem` | `=` |
| `--ea-fs-14` | `0.875rem` | `=` |
| `--ea-fs-18` | `1.125rem` | `=` |
| `--ea-fs-20` | `1.25rem` | `=` |
| `--ea-fs-26` | `1.625rem` | `=` |
| `--ea-fs-32` | `1.625rem` | `=` |
| `--ea-fs-40` | `2rem` | `=` |
| `--ea-fw-regular` | `400` | `=` |
| `--ea-fw-medium` | `500` | `=` |
| `--ea-fw-semibold` | `600` | `=` |
| `--ea-lh-tight` | `1.25` | `=` |
| `--ea-lh` | `1.5` | `=` |
| `--ea-ls-display` | `-0.025em` | `=` |
| `--ea-ls-title` | `-0.01em` | `=` |
| `--ea-ls-label` | `0.08em` | `=` |
| `--ea-sp-1` | `4px` | `=` |
| `--ea-sp-2` | `8px` | `=` |
| `--ea-sp-3` | `12px` | `=` |
| `--ea-sp-4` | `16px` | `=` |
| `--ea-sp-5` | `20px` | `=` |
| `--ea-sp-6` | `24px` | `=` |
| `--ea-sp-8` | `32px` | `=` |
| `--ea-sp-10` | `40px` | `=` |
| `--ea-sp-12` | `48px` | `=` |
| `--ea-sp-16` | `64px` | `=` |
| `--ea-page-pad` | `16px` | `=` |
| `--ea-section-gap` | `32px` | `=` |
| `--ea-panel-pad` | `16px` | `=` |
| `--ea-control` | `40px` | `=` |
| `--ea-control-sm` | `32px` | `=` |
| `--ea-r-control` | `6px` | `=` |
| `--ea-r-card` | `10px` | `=` |
| `--ea-r-round` | `999px` | `=` |
| `--ea-r-button` | `999px` | `=` |
| `--ea-focus` | `2px solid var(--ea-brand)` | `=` |
| `--ea-focus-color` | `var(--ea-brand)` | `=` |
| `--ea-focus-offset` | `2px` | `=` |
| `--ea-fill-go` | `#188038` | `=` |
| `--ea-fill-info` | `#1967D2` | `=` |
| `--ea-fill-caution` | `#F9AB00` | `=` |
| `--ea-fill-stop` | `#C5221F` | `=` |
| `--ea-fill-go-hover` | `#0D652D` | `=` |
| `--ea-fill-info-hover` | `#185ABC` | `=` |
| `--ea-fill-caution-hover` | `#E8A000` | `=` |
| `--ea-fill-stop-hover` | `#A50E0E` | `=` |
| `--ea-scrim` | `rgba(13, 13, 13, .55)` | `rgba(0, 0, 0, .7)` |
| `--ea-sidebar-w` | `248px` | `=` |
| `--ea-sidebar-w-collapsed` | `64px` | `=` |
| `--ea-header-h` | `56px` | `=` |
| `--ea-content-max` | `1440px` | `=` |
| `--ea-dur-1` | `120ms` | `=` |
| `--ea-dur-2` | `200ms` | `=` |
| `--ea-dur-3` | `280ms` | `=` |
| `--ea-dur-icon` | `520ms` | `=` |
| `--ea-dur-fill` | `600ms` | `=` |
| `--ea-ease` | `cubic-bezier(.2, 0, 0, 1)` | `=` |
| `--ea-ease-in` | `cubic-bezier(0, 0, .2, 1)` | `=` |
| `--ea-ease-out` | `cubic-bezier(.4, 0, 1, 1)` | `=` |
| `--ea-z-sticky` | `10` | `=` |
| `--ea-z-sidebar` | `20` | `=` |
| `--ea-z-menu` | `30` | `=` |
| `--ea-z-dialog` | `50` | `=` |
| `--ea-z-toast` | `60` | `=` |
| `--ea-chrome` | `#F2F0EA` | `#0A0A0A` |
