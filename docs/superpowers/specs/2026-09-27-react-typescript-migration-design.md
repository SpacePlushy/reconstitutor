# Reconstitutor: React + TypeScript rebuild — design

Date: 2026-09-27
Status: approved in conversation, awaiting written-spec review
Builds on: [2026-09-26-reconstitution-calculator-design.md](2026-09-26-reconstitution-calculator-design.md)

## Purpose

Rebuild the retatrutide reconstitution calculator as a standard React + TypeScript project with a refreshed, clean clinical look. The calculator's behaviour does not change: same two tabs, same math, same messages.

### Understanding

What the user said:
- Make the website "a proper React and TypeScript project".
- Stack: Vite + React + TypeScript, with Tailwind and shadcn/ui.
- Refresh the look rather than preserve it. Direction: clean clinical: crisp, neutral, high-contrast, numbers front and centre.
- It will eventually be hosted on Vercel, but deploying is out of scope for now.

Assumptions (confirmed during design review):
- Every formula, rounding rule, message and number format in the 2026-09-26 spec stays exactly as it is.
- The existing tests are the proof of that, and move over almost line for line.
- "Proper" means strict TypeScript, linting, formatting, component tests and one command that checks everything.
- Opening the page straight from disk is no longer a requirement.

### Success criteria

- `npm run check` passes with zero errors and zero warnings: type check, lint, format check, tests, production build.
- The ported `calc` and `syringe` tests pass unchanged in meaning.
- Component tests cover the behaviours `app.js` handled by hand (listed under Testing).
- Both tabs work at 390px and desktop widths, in light and dark mode, and look like the clinical direction below. Checked with screenshots.
- `npm run build` writes a static site to `dist/`, which Vercel's Vite preset picks up with no extra configuration.

## Out of scope

Deploying or linking Vercel, CI workflows, new calculator features, saving anything between visits, routing, a server, and everything already out of scope in the 2026-09-26 spec.

## What carries over unchanged

From the 2026-09-26 spec, these sections still apply word for word: **Domain rules**, **Tab 1: Mix a vial**, **Tab 2: Draw a dose**, **Shared behaviour**, **Number formatting**, the **Syringe drawing** rules and the **Accessibility** requirements.

Its **Visual design** (colour tokens, type, layout sizes) and **Architecture** sections are replaced by this document. The 2026-09-26 spec gets a note at the top saying so, and its "opens from disk" success criterion is marked as superseded.

## Stack and tooling

- **npm** as the package manager, current stable versions of everything at install time.
- **Vite** with `@vitejs/plugin-react`.
- **React 19** with **TypeScript**, `strict: true` plus `noUncheckedIndexedAccess`.
- **Tailwind CSS v4** via `@tailwindcss/vite`.
- **shadcn/ui**, installed with its CLI; generated components live in `src/components/ui/` and are ours to edit.
- **Vitest**, with **React Testing Library**, `@testing-library/user-event` and `@testing-library/jest-dom` on a **jsdom** environment for component tests.
- **ESLint** (flat config, `typescript-eslint` type-aware rules, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) and **Prettier** (with `prettier-plugin-tailwindcss`).
- Fonts are self-hosted through Fontsource packages rather than a Google Fonts link. If a family isn't on Fontsource, fall back to the Google Fonts `<link>`.

### npm scripts

| Script | Runs |
|---|---|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `test` | `vitest run` |
| `lint` | `eslint . --max-warnings 0` |
| `format` | `prettier --write .` |
| `check` | type check, `lint`, `prettier --check .`, `test`, `build`, stopping at the first failure |

### Housekeeping

- `.gitignore` adds `dist/` and `.playwright-mcp/`.
- `.claude/launch.json` runs `npm run dev` on port 5173 instead of `python3 -m http.server`.

## Project layout

```
reconstitutor/
├── index.html               Vite entry: mounts #root, sets title and colour-scheme
├── package.json, tsconfig*.json, vite.config.ts, eslint.config.js,
│   .prettierrc, components.json
├── src/
│   ├── main.tsx             createRoot, imports index.css
│   ├── App.tsx              owns state, derives results, lays out the page
│   ├── index.css            Tailwind, theme tokens, fonts, syringe styles
│   ├── lib/
│   │   ├── calc.ts          calc.js ported: pure math and formatting, no React
│   │   ├── syringe.ts       syringe geometry as numbers, no markup
│   │   ├── text.ts          glueUnits, splitFigure
│   │   └── utils.ts         shadcn's cn()
│   └── components/
│       ├── ui/              shadcn: tabs, input, label, toggle-group, table
│       ├── ModeTabs.tsx
│       ├── AmountField.tsx
│       ├── SyringePicker.tsx
│       ├── AnswerCard.tsx
│       ├── Notices.tsx
│       ├── WaterOptionsTable.tsx
│       ├── WorkedMath.tsx
│       └── SyringeDiagram.tsx
└── test/
    ├── calc.test.ts
    ├── syringe.test.ts
    ├── text.test.ts
    └── App.test.tsx
```

Removed: the old root `index.html` (replaced by Vite's), `app.js`, `calc.js`, `syringe.js`, `styles.css`, `test/*.test.js`.

## Modules

### `lib/calc.ts`

A direct port of `calc.js` to an ES module with named exports. The logic, constants, messages and export list stay the same; only types are added.

Types:
- `SyringeKey = "0.3" | "0.5" | "1"`, and `SyringeSpec` for each entry of `SYRINGES`.
- `AmountField = "vialMg" | "waterMl" | "doseMg"`.
- `CalcMessage { code: MessageCode; field?: AmountField; message: string }`, where `MessageCode` is a string-literal union of every code `calc.js` produces today.
- `RowStatus = "ok" | "wont-fit" | "hard-to-measure" | "between-marks"`.
- Result types for `drawForDose` and `waterOptions` that describe their current return values exactly.

`parseAmount` keeps returning `number | null`.

### `lib/syringe.ts`

The geometry half of `syringe.js`. It exports the SVG constants (`VIEW_WIDTH`, `VIEW_HEIGHT`, `SCALE_TOP`, `SCALE_LENGTH` and the rest), `unitToY`, `syringePosition`, `describeSyringe`, and a new `scaleMarks(syringe)` that returns `{ units, y, major }[]`: the tick list the old `scaleMarkup` looped over. `renderSyringe` goes away; `SyringeDiagram` draws the same shapes from these numbers.

`SyringeState = "ok" | "overflow" | "empty"`.

### `lib/text.ts`

The two pure helpers from `app.js`:
- `glueUnits(text)`: replaces the space between a number and its unit with a non-breaking space, same regex as today.
- `splitFigure(text)`: `"40 units"` → `{ number: "40", unit: "units" }`; returns `null` when the text doesn't start with a number (for example `"less than 0.1 units"`), so the answer shows it as one piece.

## State and data flow

`App.tsx` holds all state:

```ts
const [mode, setMode] = useState<"mix" | "draw">("mix");
const [text, setText] = useState({ vialMg: "", waterMl: "", doseMg: "" });
const [syringe, setSyringe] = useState<SyringeKey>("1");
const [selectedWaterMl, setSelectedWaterMl] = useState<number | null>(null);
```

Everything else is derived during render, in `useMemo`:
- `values` from `parseAmount` on each field, plus `syringe`.
- Mix: `waterOptions(values)`, then the selected row: the row matching `selectedWaterMl`, else the recommended row, else the first row.
- Draw: `drawForDose(values)`.

No calculated value is stored in state.

Reset rules, as in `app.js`:
- Editing any amount field sets `selectedWaterMl` to `null`.
- Changing syringe sets `selectedWaterMl` to `null`.
- Switching mode leaves it alone.
- Vial, dose and syringe are shared between tabs; water is only shown in Draw but its text is kept.

The page renders one workspace whose contents depend on `mode`. `ModeTabs` wraps it with shadcn Tabs: each tab's panel renders the same workspace for its mode, so switching tabs remounts the panel but loses nothing, because all values live in `App`.

## Components

| Component | Job |
|---|---|
| `ModeTabs` | shadcn Tabs: "Mix a vial" / "Draw a dose". Arrow keys move between tabs. |
| `AmountField` | Label, text input (`inputMode="decimal"`, `autoComplete="off"`), unit suffix, field error. Shows the error only when the text is non-empty and not `isIncompleteAmount`, sets `aria-invalid` and `aria-describedby`. |
| `SyringePicker` | shadcn ToggleGroup, single choice: 0.3 mL / 0.5 mL / 1 mL, with a visible "Syringe" label. Ignores the empty value Radix emits when the active item is pressed again, so there is always a syringe. |
| `AnswerCard` | `aria-live="polite"` region. Empty state: the prompt for the mode, or general (non-field) errors. Mix: "Add **1.5** mL of bacteriostatic water", Measure line, strength and dose line, doses-in-vial line. Draw: "Draw to **40** units", volume and strength line, nearest-mark line when present. Both end with `Notices`. |
| `Notices` | List of warning/error messages, caution rule on the left, text in the foreground colour. |
| `WaterOptionsTable` | Mix only. shadcn Table with a visually hidden caption. Columns: Water, Strength, Dose, 1 mg =. Each row holds a native radio input (`name="water"`) inside the Water cell's label, so arrow keys move the selection; clicking anywhere else on the row selects it too. Status under the water amount: ★ Recommended, Won't fit, Hard to measure or Between marks. Strength hidden at 480px and below. |
| `WorkedMath` | Draw only. "How this was worked out" heading and the three-step ordered list. |
| `SyringeDiagram` | The SVG, drawn from `lib/syringe.ts`. `role="img"` with `describeSyringe` as its label, `data-state` for styling. Rendered with `key={syringe}`, so it rebuilds only when the syringe changes; otherwise React updates the fill `scaleY` and the moving groups' `translateY`, and the CSS transition slides the plunger. Caption: "Read at the top edge of the rubber stopper." |

All visible text passes through `glueUnits`, so numbers never wrap away from their units.

The footer line stays: "This does arithmetic only. Check your numbers with your prescriber or pharmacist."

## Visual design: clean clinical

A precise instrument: neutral surfaces, high contrast, numbers set like readouts. The syringe stays the one bold element.

### Theme tokens

Defined as CSS variables in `index.css`, mapped onto shadcn's names (`--background`, `--foreground`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`) plus three of our own. Dark mode follows `prefers-color-scheme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#FAFBFC` | `#0E1418` | Page |
| foreground | `#0B1B26` | `#E6EDF1` | Text, syringe markings, focus ring |
| muted-foreground | `#52616B` | `#93A3AD` | Secondary text |
| border / input | `#D5DDE3` | `#26323B` | Hairlines, field outlines |
| destructive (caution) | `#B3261E` | `#FF8A80` | Errors and warnings |
| draw | `#F25C05` | `#FF7A2E` | Syringe draw line, Recommended star, selected-row bar |
| solution | `#DCEBF3` | `#1F3B4A` | Liquid in the barrel |
| stopper | `#1F2429` | `#AEB8BF` | Rubber stopper |

These are starting values. The frontend-design pass during the build may tune them, as long as text meets WCAG AA in both themes, `draw` stays at least 3:1 against the background, and orange keeps its single meaning: "this is the amount to use". Orange is never used for text; the Recommended label is an orange star followed by text in the foreground colour.

Radius is small (`0.25rem`). No shadows, no gradients, no decorative cards.

### Type

- **Atkinson Hyperlegible Next** for all prose and labels; weights 400, 600, 700.
- **IBM Plex Mono** for every number the calculator produces: the big answer figure, table cells, the syringe labels and the amount inputs.
- Body 17px; the main answer figure stays about 54px.
- No all-caps labels.

### Layout

- Phone (below 640px): one column: title, tabs, fields, syringe picker, answer, syringe, then the table (Mix) or worked math (Draw).
- 640px and up: fields and answer on the left, syringe in a column on the right, table or worked math full width underneath, all inside a centred column.
- Sections separated by 1px rules, not boxes.
- Options table: tight rows, numbers right-aligned in mono, the selected row marked by a 3px `draw`-coloured bar on its left edge.

### Motion

Only the plunger and fill move, about 250ms, and not at all under `prefers-reduced-motion`.

### Accessibility

As in the 2026-09-26 spec: visible labels, keyboard focus visible on every control, `aria-live` answer, AA contrast in both themes. Mode is a tablist (shadcn Tabs) instead of a radio group; the syringe picker and table rows remain single-choice groups operable with arrow keys.

The detailed visual work is done with the frontend-design skill during implementation.

## Testing

All tests run with `vitest run`. Math tests use the Node environment; `App.test.tsx` uses jsdom.

1. **`calc.test.ts`**: `calc.test.js` ported. `require` becomes `import`, `node:test`'s `test` becomes Vitest's, and assertions keep using `node:assert/strict`, so every assertion keeps its exact meaning. No test is removed or loosened.
2. **`syringe.test.ts`**: `unitToY`, `syringePosition` and `describeSyringe` tests ported as-is. The two `renderSyringe` markup tests become `scaleMarks` tests: 31/51/51 ticks and 7/11/11 major ticks for the 0.3/0.5/1 mL syringes, with the expected `y` at 0 and at capacity.
3. **`text.test.ts`**: `glueUnits` (glues units, mg/mL, mL and mg, treating "5 mg/mL" as one unit; leaves a unit that runs into another word unglued) and `splitFigure` (number + unit, and `null` for "less than 0.1 units").
4. **`App.test.tsx`**, through the rendered page:
   - Switching from Mix to Draw and back keeps the vial and dose text.
   - Typing `0.` shows no field error; typing `abc` shows one and sets `aria-invalid`.
   - 10 mg vial, 2 mg dose, 1 mL syringe answers "Add 1.0 mL" with the 1.0 mL row selected and marked Recommended.
   - Clicking a cell in the 2.0 mL row (not the radio) selects that row and changes the answer.
   - After selecting a row, editing the dose or changing the syringe goes back to the recommended row.
   - Draw with a dose that won't fit the chosen syringe shows the won't-fit message, and the syringe has `data-state="overflow"`.
   - The syringe's accessible name matches `describeSyringe`, such as "1 mL syringe drawn to 20 units".

Order: the ported `calc` and `syringe` tests pass against the new TypeScript modules before any component is written.

### Visual check

Run the dev server and take browser screenshots of both tabs, in light and dark mode, at 390px and 1280px wide, including one won't-fit state. Fix problems, then show the screenshots to the user.

## Version control

Work on branch `react-typescript`, cut from `build-calculator`. Commit the spec, then each finished step of the plan.
