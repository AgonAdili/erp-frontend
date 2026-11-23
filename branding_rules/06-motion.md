# 06 · Motion
Motion explains what changed. It never decorates. EACore is used all day, so motion is short, rare and the same everywhere.

## 1 · Tokens
| Token | Value | Use |
|---|---|---|
| `--ea-dur-1` | 120ms | hover, press, checkbox, switch, colour |
| `--ea-dur-2` | 200ms | menus, tooltips, tab marker, toast in, accordion |
| `--ea-dur-3` | 280ms | dialog, drawer, sidebar |
| `--ea-dur-fill` | 600ms | bars, rings and progress grow **once** from 0 when first in view; values appear after |
| `--ea-dur-icon` | 520ms | the one icon motion in the module launcher |
| `--ea-ease` / `-in` / `-out` | `cubic-bezier(.2,0,0,1)` / `(0,0,.2,1)` / `(.4,0,1,1)` | moving / appearing / leaving (exits run at about 75 % of the enter time) |

## 2 · What moves
| Element | Motion |
|---|---|
| Menu, dropdown | fade + 4px rise, `--ea-dur-2` in, `--ea-dur-1` out |
| Tooltip | after 400ms on hover, at once on keyboard focus; neighbours show at once |
| Dialog | scrim fades; panel fades and scales .98 → 1, `--ea-dur-3` |
| Drawer | slides in from the right, `--ea-dur-3` |
| Toast | rises 8px and fades, `--ea-dur-2` |
| Tabs, segmented control | the marker slides to the choice, `--ea-dur-2` |
| Approved row in a queue | slides out and the list closes up; the queue count changes |
| New or updated row | a brief solid flash that fades over 1.2 s |
| Skeleton | solid pulse `--ea-subtle` ↔ `--ea-line`, 1.4 s |
| Kanban card | lifts and tilts ≤ 2°, settles into its slot |
| Live count | only the changed digits roll, ≤ 280ms, in the direction of the change |

## 3 · Never
- **Numbers never count up.** Money never animates; it changes at once. The only rolling numbers are live operational counts.
- No motion inside stats or goal widgets. Rings, bars and lines appear already drawn after the first fill.
- No page transitions, parallax, bounce, overshoot, confetti or looping animation (only the skeleton and spinners loop).
- No animated charts on filter change: they update in place.
- Nothing delays input; a click goes through any animation.
- Animate only `transform` and `opacity` where possible. Never `transition: all`.

## 4 · Reduced motion
`prefers-reduced-motion: reduce` turns every movement into an instant change. Every state must still be visible without motion; motion is never the only cue.
