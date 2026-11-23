# 05 · Data visualisation

## 1 · Every widget answers one question
| The user asks… | Use | Not |
|---|---|---|
| How far are we from the target? | **Bullet:** bar from 0 = now, black tick = target, grey tick = previous. Month to date: the target is pro rata for today | Gauges, rings, thermometers |
| Which category is bigger? | **Horizontal bars**, sorted, longest first; top 5–7 + "Останати" in grey | Donuts, vertical bars with rotated labels |
| How does it change over time? | **Line** for balances and rates; **columns** for amounts per period, with a dashed target line | A line over under 5 points (show the numbers) |
| What is it made of? | **One stacked bar**, ≤ 5 parts, values + unit + total written | Pie (only as an add-on beside another chart) |
| Are two measures related? | **Quadrant / scatter**, corners labelled in words | — (over 20 items → sortable table) |
| When does what happen? | **Gantt / time lane** with "today" | — |
| Where do items pile up across two dimensions? | **Heat / highlight table** (one hue, five steps, "помалку … повеќе") | Rainbow scales |
| Which unit is in which state? | **Unit tiles**, 1 tile = 1 unit, grouped by state (≤ ~200 units) | — |
| Was the rule met each day? | **Day tracker**, 14 days, only with a daily rule | Sparklines |
| Where is it? | **Map** (map pages only) | — |
| What exactly is the number? | **Table / list** | A chart when exact values are the point |

## 2 · Rules for every chart
- **Axis from 0;** no truncated axes. Length and area follow the value.
- **Colour:**
  - main series ink (`--ea-chart-1`);
  - comparison, plan or previous in taupe (`--ea-chart-2`);
  - a third series only when unavoidable (`--ea-chart-3`);
  - "Other" or under target in light grey (`--ea-chart-4`).

  Status colours appear **only** where a value is judged (a red point under the floor, a late bar). No rainbow.
- **Solid fills only:** no gradient or translucent areas, no 3D, no shadows. Gridlines are hairlines, as few as possible.
- **Text with intent:**
  - a title that states the question ("Трошоци по проект, овој месец, топ 10");
  - the unit and total in every legend;
  - labels at 12px in HTML (they never scale down);
  - direct labels over legends where possible.
- **Every bar, point and segment links** to the list behind it and has a tooltip.
- **Accessible:**
  - every chart has an `aria-label` summary sentence;
  - "Прикажи ги податоците" shows the same data as a table;
  - a narrow chart shows every second period label rather than letting labels touch.
- **HTML and CSS first.** Bars, bullets, splits, columns, rings and heat tables are HTML / SVG laid out by CSS from shares the server computes (0–1). Chart.js only where an interactive chart is really needed, self-hosted, reading colours from the tokens.
- The server computes the chart data (shares, ticks, points, tones) with the shared helpers; the browser only lays it out.

## 3 · Boards
- **First screen:** the greeting, 4 figures and 2–3 widgets. Show exceptions: a figure on target doesn't shout; one off target can't be missed.
- **Each figure carries its context:** target, trend, change, owner, and "Како се чита".
- **Anomalies:** a value outside about 2 standard deviations of the last weeks is marked "Невообичаено", with its normal range shown as a band.
- **Live counts** (people on site, vehicles out) refresh every 15 s while the tab is visible, and pause with the board's pause control.
