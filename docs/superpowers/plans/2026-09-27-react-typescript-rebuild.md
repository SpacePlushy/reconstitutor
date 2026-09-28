# React + TypeScript Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the retatrutide reconstitution calculator as a Vite + React + TypeScript project with Tailwind and shadcn/ui, a clean clinical look, and identical math and messages.

**Architecture:** `src/lib/calc.ts` and `src/lib/syringe.ts` are typed, pure ports of today's `calc.js` and `syringe.js`. `App.tsx` owns four pieces of state and derives every result with `useMemo`; small components render inputs, the answer, the syringe SVG, the water table and the worked math. The old app moves to `legacy/` so it can be compared side by side, and is deleted in the last task.

**Tech Stack:** Vite 8, React 19, TypeScript 6.0 (not 7: typescript-eslint supports `<6.1.0`), Tailwind CSS 4, shadcn/ui 4 (Radix base, `radix-lyra` style), Vitest 5 + React Testing Library + jsdom 30, ESLint 10 + typescript-eslint 8 (strict, type-aware), Prettier 3.

**Spec:** `docs/superpowers/specs/2026-09-27-react-typescript-migration-design.md` (builds on `docs/superpowers/specs/2026-09-26-reconstitution-calculator-design.md`, whose domain rules, tab behaviour, messages and number formatting still apply word for word).

**Branch:** `react-typescript` (already checked out, cut from `build-calculator`).

## Global Constraints

- Every formula, rounding rule, message and number format stays exactly as in the 2026-09-26 spec. The ported tests are the proof; no test is removed or loosened.
- TypeScript `strict: true` plus `noUncheckedIndexedAccess`.
- `npm run check` (type check, lint, `prettier --check .`, tests, build) must pass with zero errors and zero warnings before the work is called done.
- ESLint runs with `--max-warnings 0`.
- npm is the package manager. Node `^20.19.0 || >=22.12.0` (this machine has Node 24).
- Dark mode follows `prefers-color-scheme`; there is no theme toggle.
- Orange (`--draw`) only ever means "this is the amount to use" and is never used for text.
- No all-caps labels, no shadows, no gradients, no decorative cards.
- Only the plunger and fill move (about 250ms), and not at all under `prefers-reduced-motion`.
- Every number and its unit stay on one line (`glueUnits` inserts a non-breaking space; write it as the escape `\u00a0` in source, never as a literal character: ESLint's `no-irregular-whitespace` rejects the literal in template strings).
- Nothing is stored between visits. No deploy, no Vercel linking, no CI in this plan.
- Commit after each task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

The spec implies these, and the original tests never exercised them. Each now has a test in the task that owns the code, except the last, which is checked in the browser in Task 6.

1. **Keyboard users moving through the water table with arrow keys** expect the chosen row and the answer to follow. Test: "mix: arrow keys move the chosen row and the answer follows" (Task 5).
2. **Switching tabs is not an edit**, so a tapped row must survive Mix → Draw → Mix. Typing in any field (including water in Draw) *does* reset it, as in `app.js`. Test: "switching tabs keeps the chosen row" (Task 5).
3. **Water typed in Draw is hidden, not lost**, when visiting Mix. Test: "water typed in Draw is still there after a trip to Mix" (Task 3).
4. **The plunger slides instead of jumping**, which only works if the same `<svg>` stays mounted while the dose changes, and is replaced when the syringe size changes. Test: "the syringe keeps its drawing while the dose changes, and redraws for a new size" (Task 4).
5. **CSS-only rules:** the Strength column is hidden at 480px and below, and the syringe transition is off under reduced motion. Checked in the browser in Task 6, Step 4.

## File map

| File | Task | Responsibility |
|---|---|---|
| `legacy/**` | 1 → deleted in 6 | The old app, kept for side-by-side comparison |
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.claude/launch.json` | 1 | Toolchain |
| `index.html`, `src/main.tsx` | 1, 3 | Vite entry; fonts and CSS imports |
| `src/lib/calc.ts` | 1 | All math and number formatting (port of `calc.js`) |
| `src/lib/syringe.ts` | 2 | Syringe geometry as numbers (port of `syringe.js`, no markup) |
| `src/lib/text.ts` | 2 | `glueUnits`, `splitFigure` |
| `src/lib/utils.ts`, `components.json`, `src/components/ui/*` | 3, 5 | shadcn plumbing and primitives |
| `src/index.css` | 1, 3, 4 | Tailwind, theme tokens, type scale, syringe styles |
| `src/components/AmountField.tsx`, `SyringePicker.tsx`, `ModeTabs.tsx` | 3 | Inputs and the mode switch |
| `src/components/Notices.tsx`, `AnswerCard.tsx`, `SyringeDiagram.tsx` | 4 | The answer and the syringe |
| `src/components/WaterOptionsTable.tsx`, `WorkedMath.tsx` | 5 | The Mix table and the Draw working |
| `src/App.tsx` | 1, 3, 4, 5 | State, derived results, page layout |
| `test/setup.ts`, `test/*.test.ts(x)` | 1–5 | Vitest setup and tests |

## Interfaces used across tasks

These are produced in Tasks 1–2 and consumed later. Exact signatures:

```ts
// src/lib/calc.ts
export type SyringeKey = "0.3" | "0.5" | "1";
export type AmountField = "vialMg" | "waterMl" | "doseMg";
export type RowStatus = "ok" | "wont-fit" | "hard-to-measure" | "between-marks";
export interface CalcMessage { code: MessageCode; field?: AmountField; message: string }
export const SYRINGES: Record<SyringeKey, SyringeSpec>;
export const SYRINGE_ORDER: readonly SyringeKey[];
export function parseAmount(text: string | undefined): number | null;
export function isIncompleteAmount(text: string | undefined): boolean;
export function drawForDose(input: DrawInput): DrawResponse;          // { result: DrawResult | null; errors; warnings }
export function waterOptions(input: MixInput): WaterOptionsResponse;  // { rows: WaterRow[]; recommendedMl; alternative; dosesInVial; leftoverMg; errors; warnings }
export function describeWaterMeasure(waterMl: number, syringe: SyringeKey): string;
export function formatMg / formatConcentration / formatMl / formatWaterMl / formatUnits / formatUnitsNumber / formatPercentOff (value: number): string;
export function formatDoses(count: number, leftoverMg: number): string;

// src/lib/syringe.ts
export type SyringeState = "ok" | "overflow" | "empty";
export interface SyringeView { syringe: SyringeKey; units: number; state: SyringeState }
export function unitToY(units: number, syringe: SyringeKey): number;
export function syringePosition(view: SyringeView): { fillScale: number; offset: number; label: string };
export function describeSyringe(view: SyringeView): string;
export function scaleMarks(syringe: SyringeKey): { units: number; y: number; major: boolean }[];
// plus geometry constants VIEW_WIDTH, VIEW_HEIGHT, CENTER_X, BARREL_LEFT, BARREL_RIGHT,
// BARREL_TOP, BARREL_BOTTOM, SCALE_TOP, SCALE_LENGTH, STOPPER_HEIGHT, THUMB_TOP

// src/lib/text.ts
export function glueUnits(text: string): string;
export function splitFigure(text: string): { number: string; unit: string } | null;
```

---

### Task 1: Toolchain and the typed calc module

Move the old app aside, set up Vite/React/TypeScript/Tailwind/Vitest/ESLint/Prettier, and port `calc.js` to `src/lib/calc.ts` test-first.

**Files:**
- Move: `index.html`, `app.js`, `calc.js`, `syringe.js`, `styles.css` → `legacy/`; `test/calc.test.js`, `test/syringe.test.js` → `legacy/test/`
- Create: `legacy/package.json` (keeps the old CommonJS tests runnable)
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.test.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/lib/calc.ts`, `test/setup.ts`, `test/calc.test.ts`
- Modify: `.gitignore`, `.claude/launch.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/lib/calc.ts` (see "Interfaces used across tasks"); the `@/` import alias (→ `src/`) in Vite, Vitest and TypeScript; `test/setup.ts` (jest-dom matchers, RTL cleanup); npm scripts `dev`, `build`, `preview`, `test`, `lint`, `format`, `typecheck`, `check`.

- [ ] **Step 1: Move the old app into `legacy/` and confirm its tests still run there**

```bash
mkdir -p legacy/test
git mv index.html app.js calc.js syringe.js styles.css legacy/
git mv test/calc.test.js test/syringe.test.js legacy/test/
# The old tests use require(). This keeps them runnable after Step 2's root
# package.json sets "type": "module", so Task 6 can re-run them before deleting legacy/.
printf '{ "type": "commonjs" }\n' > legacy/package.json
node --test legacy/test/*.test.js
```

Expected: `ℹ tests 54`, `ℹ pass 54`, `ℹ fail 0` (47 calc + 7 syringe tests; the relative `require("../calc.js")` paths still resolve). Pass the files, not the directory: `node --test legacy/test/` fails on Node 24.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "reconstitutor",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "typecheck": "tsc -b",
    "check": "npm run typecheck && npm run lint && prettier --check . && npm test && npm run build"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install react@^19.3.0 react-dom@^19.3.0
npm install -D vite@^8.3.1 @vitejs/plugin-react@^6.1.1 typescript@~6.0.3 \
  @types/react@^19.3.0 @types/react-dom@^19.3.0 @types/node@^24.19.0 \
  tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 \
  vitest@^5.0.2 jsdom@^30.1.1 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2 \
  @testing-library/user-event@^14.6.7 @testing-library/jest-dom@^7.0.1 \
  eslint@^10.11.0 @eslint/js@^10.0.1 typescript-eslint@^8.70.1 \
  eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.5.7 globals@^17.12.0 \
  prettier@^3.9.9 prettier-plugin-tailwindcss@^0.8.1
```

Expected: installs with no `ERESOLVE` peer errors. Do **not** install TypeScript 7: `typescript-eslint` 8.70 declares `typescript >=4.8.4 <6.1.0`.

- [ ] **Step 4: Write the TypeScript configs**

`tsconfig.json` (a solution file; `paths` here is what the shadcn CLI reads):

```json
{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    },
    {
      "path": "./tsconfig.test.json"
    }
  ],
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

`tsconfig.test.json` (type-checks tests; Node types for `node:assert/strict`):

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
    "types": ["node", "vite/client"]
  },
  "include": ["test", "src"]
}
```

- [ ] **Step 5: Write `vite.config.ts`** (Vitest reads its `test` block; the `@` alias serves both)

```ts
/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 6: Write the lint and format configs**

`eslint.config.js`:

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "coverage", "legacy"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Messages interpolate plain numbers; everything else must be formatted first.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // shadcn/ui files export variants alongside components.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
]);
```

`.prettierrc`:

```json
{
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/index.css"
}
```

`.prettierignore` (Prettier also skips everything in `.gitignore`):

```
dist
coverage
package-lock.json
legacy
docs
.superpowers
.github
.claude
```

- [ ] **Step 7: Update `.gitignore` and the launch config**

`.gitignore`:

```
.DS_Store
node_modules/
dist/
.playwright-mcp/
```

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "app",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 8: Write the Vite entry and a placeholder page**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Retatrutide mixing calculator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:

```tsx
// Placeholder until the calculator page is built.
export function App() {
  return <main>Retatrutide</main>;
}
```

`src/index.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 9: Write the test setup**

`test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 10: Write the failing calc test**

`test/calc.test.ts` is `legacy/test/calc.test.js` ported. The only changes: `import` instead of `require`, Vitest's `test`, typed helpers, `assert.ok(x)` before reading a value that may be `null`/`undefined` (Node's `assert.ok` narrows the type), and `?.` on array elements. Assertions keep using `node:assert/strict`, so each one means exactly what it did. There are 47 tests and 186 value assertions, the same as the original.

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import * as Calc from "@/lib/calc";
import type { CalcMessage, SyringeKey } from "@/lib/calc";

const codes = (list: CalcMessage[]) => list.map((item) => item.code);
const draw = (vialMg: number, waterMl: number, doseMg: number, syringe: SyringeKey = "1") =>
  Calc.drawForDose({ vialMg, waterMl, doseMg, syringe });
const options = (vialMg: number, doseMg: number, syringe: SyringeKey = "1") =>
  Calc.waterOptions({ vialMg, doseMg, syringe });

// --- syringes, parsing, formatting -------------------------------

test("SYRINGES describes the three U-100 syringes", () => {
  assert.deepEqual(Calc.SYRINGE_ORDER, ["0.3", "0.5", "1"]);
  assert.deepEqual(
    Calc.SYRINGE_ORDER.map((key) => [
      Calc.SYRINGES[key].capacityUnits,
      Calc.SYRINGES[key].markSpacing,
      Calc.SYRINGES[key].labelEvery,
    ]),
    [
      [30, 1, 5],
      [50, 1, 5],
      [100, 2, 10],
    ],
  );
  assert.equal(Calc.SYRINGES["0.5"].capacityMl, 0.5);
  assert.equal(Calc.SYRINGES["1"].label, "1 mL");
});

test("parseAmount reads positive decimals, with . or ,", () => {
  assert.equal(Calc.parseAmount("10"), 10);
  assert.equal(Calc.parseAmount(" 2.5 "), 2.5);
  assert.equal(Calc.parseAmount(".5"), 0.5);
  assert.equal(Calc.parseAmount("2."), 2);
  assert.equal(Calc.parseAmount("2,5"), 2.5);
});

test("parseAmount rejects empty, zero, negative and non-numeric input", () => {
  for (const text of [
    "",
    "   ",
    "0",
    "0.0",
    "-1",
    "abc",
    "1e3",
    "1.2.3",
    "1,2,3",
    ".",
    "5 mg",
    "Infinity",
  ]) {
    assert.equal(Calc.parseAmount(text), null, JSON.stringify(text));
  }
  assert.equal(Calc.parseAmount(undefined), null);
});

test("parseAmount rejects a comma that reads as a thousands separator", () => {
  for (const text of ["1,000", "2,500", "12,500", "100,000"]) {
    assert.equal(Calc.parseAmount(text), null, JSON.stringify(text));
  }
  assert.equal(Calc.parseAmount("0,125"), 0.125);
  assert.equal(Calc.parseAmount("10,25"), 10.25);
  assert.equal(Calc.parseAmount("1,0005"), 1.0005);
});

test("formatMg shows up to 3 decimals", () => {
  assert.equal(Calc.formatMg(2), "2 mg");
  assert.equal(Calc.formatMg(0.25), "0.25 mg");
  assert.equal(Calc.formatMg(1.9), "1.9 mg");
  assert.equal(Calc.formatMg(0.125), "0.125 mg");
  assert.equal(Calc.formatMg(1.23456), "1.235 mg");
});

test("formatConcentration shows up to 2 decimals", () => {
  assert.equal(Calc.formatConcentration(5), "5 mg/mL");
  assert.equal(Calc.formatConcentration(10 / 1.5), "6.67 mg/mL");
  assert.equal(Calc.formatConcentration(10 / 3), "3.33 mg/mL");
  assert.equal(Calc.formatConcentration(2.5), "2.5 mg/mL");
});

test("formatMl shows 2 decimals, or 3 when needed", () => {
  assert.equal(Calc.formatMl(0.4), "0.40 mL");
  assert.equal(Calc.formatMl(0.30000000000000004), "0.30 mL");
  assert.equal(Calc.formatMl(0.395), "0.395 mL");
  assert.equal(Calc.formatMl(1), "1.00 mL");
});

test("formatWaterMl shows 1 decimal, or 2 when needed", () => {
  assert.equal(Calc.formatWaterMl(1), "1.0 mL");
  assert.equal(Calc.formatWaterMl(2.4), "2.4 mL");
  assert.equal(Calc.formatWaterMl(1.25), "1.25 mL");
});

test("formatUnits shows up to 1 decimal", () => {
  assert.equal(Calc.formatUnits(40), "40 units");
  assert.equal(Calc.formatUnits(22.5), "22.5 units");
  assert.equal(Calc.formatUnits(30.000000000000004), "30 units");
  assert.equal(Calc.formatUnits(20.8333), "20.8 units");
  assert.equal(Calc.formatUnits(1), "1 unit");
  assert.equal(Calc.formatUnits(0.5), "0.5 units");
});

test("formatUnits never shows a real dose as 0 units", () => {
  assert.equal(Calc.formatUnits(0.03), "less than 0.1 units");
  assert.equal(Calc.formatUnits(0), "0 units");
});

test("formatPercentOff says over or under", () => {
  assert.equal(Calc.formatPercentOff(0.0256), "3% over");
  assert.equal(Calc.formatPercentOff(-0.05), "5% under");
  assert.equal(Calc.formatPercentOff(0.004), "less than 1% over");
});

test("formatDoses counts full doses and any leftover", () => {
  assert.equal(Calc.formatDoses(5, 0), "5 doses in the vial");
  assert.equal(Calc.formatDoses(1, 0.5), "1 dose in the vial, plus 0.5 mg left over");
  assert.equal(Calc.formatDoses(4, 2), "4 doses in the vial, plus 2 mg left over");
});

// --- drawForDose --------------------------------------------------

test("drawForDose: 10 mg vial, 2 mL water, 2 mg dose", () => {
  const { result, errors, warnings } = draw(10, 2, 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(result);
  assert.equal(result.concentration, 5);
  assert.equal(result.ml, 0.4);
  assert.equal(result.units, 40);
  assert.equal(result.unitsPerMg, 20);
  assert.equal(result.onMark, true);
  assert.equal(result.fits, true);
  assert.equal(result.measurable, true);
  assert.equal(result.nearestMarkText, null);
  assert.equal(result.dosesInVial, 5);
  assert.equal(result.leftoverMg, 0);
  assert.deepEqual(result.workedMath, [
    "10 mg ÷ 2.0 mL = 5 mg/mL",
    "2 mg ÷ 5 mg/mL = 0.40 mL",
    "0.40 mL × 100 = 40 units",
  ]);
});

test("drawForDose removes floating-point noise", () => {
  const { result } = draw(5, 3, 0.5, "0.5");
  assert.ok(result);
  assert.equal(result.units, 30);
  assert.equal(result.ml, 0.3);
  assert.equal(result.onMark, true);
});

test("drawForDose: a dose halfway between 2-unit marks rounds up", () => {
  const { result, warnings } = draw(10, 2, 1.95);
  assert.ok(result);
  assert.equal(result.units, 39);
  assert.equal(result.onMark, false);
  assert.equal(result.nearestMark, 40);
  assert.equal(result.doseAtMarkMg, 2);
  assert.equal(result.nearestMarkText, "Nearest mark: 40 units = 2 mg (3% over)");
  assert.deepEqual(warnings, []);
});

test("drawForDose: 1-unit marks on the smaller syringes", () => {
  const { result } = draw(10, 2, 2.03, "0.5");
  assert.ok(result);
  assert.equal(result.units, 40.6);
  assert.equal(result.nearestMark, 41);
  assert.equal(result.nearestMarkText, "Nearest mark: 41 units = 2.05 mg (1% over)");
});

test("drawForDose: leftover after the last full dose", () => {
  const { result } = draw(12, 2, 2.5);
  assert.ok(result);
  assert.equal(result.dosesInVial, 4);
  assert.equal(result.leftoverMg, 2);
});

test("drawForDose reports missing inputs by field", () => {
  const { result, errors } = Calc.drawForDose({
    vialMg: null,
    waterMl: 2,
    doseMg: null,
    syringe: "1",
  });
  assert.equal(result, null);
  assert.deepEqual(
    errors.map((e) => [e.code, e.field]),
    [
      ["missing-vial", "vialMg"],
      ["missing-dose", "doseMg"],
    ],
  );
  assert.equal(errors[0]?.message, "Enter the vial amount in mg.");
  const water = Calc.drawForDose({ vialMg: 10, waterMl: null, doseMg: 2, syringe: "1" });
  assert.equal(water.errors[0]?.message, "Enter the water added in mL.");
});

test("drawForDose rejects a dose bigger than the vial", () => {
  const { result, errors } = draw(10, 2, 12);
  assert.equal(result, null);
  assert.deepEqual(codes(errors), ["dose-exceeds-vial"]);
  assert.equal(errors[0]?.message, "Your dose is more than the whole vial (10 mg).");
});

test("drawForDose allows a dose equal to the whole vial", () => {
  const { result, errors } = draw(10, 1, 10);
  assert.deepEqual(errors, []);
  assert.ok(result);
  assert.equal(result.units, 100);
  assert.equal(result.fits, true);
  assert.equal(result.dosesInVial, 1);
});

test("drawForDose: dose that won't fit the chosen syringe", () => {
  const { result, errors, warnings } = draw(10, 2, 2, "0.3");
  assert.ok(result);
  assert.equal(result.units, 40);
  assert.equal(result.fits, false);
  assert.equal(result.nearestMarkText, null);
  assert.deepEqual(codes(errors), ["wont-fit"]);
  assert.equal(
    errors[0]?.message,
    "40 units won't fit in a 0.3 mL (30-unit) syringe. Use a 0.5 mL or 1 mL syringe, or split it into 2 draws.",
  );
  assert.deepEqual(warnings, []);
});

test("drawForDose: dose that won't fit any syringe", () => {
  const { errors } = draw(10, 3, 5);
  assert.equal(
    errors[0]?.message,
    "150 units won't fit in a 1 mL (100-unit) syringe. Split it into 2 draws.",
  );
});

test("drawForDose: a dose exactly at capacity fits", () => {
  const { result, errors } = draw(10, 1.5, 2, "0.3");
  assert.ok(result);
  assert.equal(result.units, 30);
  assert.deepEqual(errors, []);
});

test("drawForDose: 1 mL syringe needs at least 20 units to be measurable", () => {
  const below = draw(10, 1, 1.8);
  assert.ok(below.result);
  assert.equal(below.result.units, 18);
  assert.deepEqual(codes(below.warnings), ["hard-to-measure"]);
  assert.equal(
    below.warnings[0]?.message,
    "Each mark on this syringe is 2 units, so misreading by one mark changes this dose by 11%. A 0.3 mL or 0.5 mL syringe reads more finely.",
  );
  assert.deepEqual(draw(10, 1, 2).warnings, []);
});

test("drawForDose: 0.3 and 0.5 mL syringes need at least 10 units", () => {
  const below = draw(10, 1, 0.9, "0.5");
  assert.ok(below.result);
  assert.equal(below.result.units, 9);
  assert.equal(
    below.warnings[0]?.message,
    "Each mark on this syringe is 1 unit, so misreading by one mark changes this dose by 11%. Mixing your next vial with more water makes each dose bigger and easier to measure.",
  );
  assert.deepEqual(draw(10, 1, 1, "0.3").warnings, []);
});

test("drawForDose: tiny doses rounding to mark 0 get no nearest-mark line", () => {
  const { result, warnings } = draw(100, 1, 0.005);
  assert.ok(result);
  assert.equal(result.nearestMark, 0);
  assert.equal(result.nearestMarkText, null);
  assert.deepEqual(codes(warnings), ["hard-to-measure"]);
});

// --- measuring water and the options table -----------------------

test("measureWater counts full syringes and the remainder", () => {
  assert.deepEqual(Calc.measureWater(1, "1"), { fullSyringes: 1, remainderUnits: 0 });
  assert.deepEqual(Calc.measureWater(2.4, "1"), { fullSyringes: 2, remainderUnits: 40 });
  assert.deepEqual(Calc.measureWater(1, "0.3"), { fullSyringes: 3, remainderUnits: 10 });
  assert.deepEqual(Calc.measureWater(1.2, "0.3"), { fullSyringes: 4, remainderUnits: 0 });
  assert.deepEqual(Calc.measureWater(3, "0.3"), { fullSyringes: 10, remainderUnits: 0 });
  assert.deepEqual(Calc.measureWater(1.5, "0.5"), { fullSyringes: 3, remainderUnits: 0 });
});

test("describeWaterMeasure words the measurement", () => {
  assert.equal(Calc.describeWaterMeasure(1, "1"), "1 full syringe");
  assert.equal(Calc.describeWaterMeasure(3, "1"), "3 full syringes");
  assert.equal(Calc.describeWaterMeasure(1.5, "1"), "1 full syringe + 50 units");
  assert.equal(Calc.describeWaterMeasure(2.4, "1"), "2 full syringes + 40 units");
  assert.equal(Calc.describeWaterMeasure(0.8, "1"), "Draw to 80 units");
});

test("waterOptions: 10 mg vial, 2 mg dose, 1 mL syringe recommends 1.0 mL", () => {
  const res = options(10, 2);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.recommendedMl, 1);
  assert.deepEqual(
    res.rows.map((r) => r.waterMl),
    [1, 1.5, 2, 2.5, 3],
  );
  assert.deepEqual(
    res.rows.map((r) => r.units),
    [20, 30, 40, 50, 60],
  );
  assert.deepEqual(
    res.rows.map((r) => r.recommended),
    [true, false, false, false, false],
  );
  const first = res.rows[0];
  assert.ok(first);
  assert.equal(first.concentration, 10);
  assert.equal(first.unitsPerMg, 10);
  assert.equal(first.status, "ok");
  assert.equal(first.easyMath, true);
  assert.equal(first.note, null);
  assert.equal(res.dosesInVial, 5);
  assert.equal(res.leftoverMg, 0);
});

test("waterOptions: a recommendation between half-mL steps gets its own row", () => {
  const res = options(12, 2.5);
  assert.equal(res.recommendedMl, 2.4);
  assert.deepEqual(
    res.rows.map((r) => r.waterMl),
    [1, 1.5, 2, 2.4, 2.5, 3],
  );
  const recommended = res.rows.find((r) => r.recommended);
  assert.ok(recommended);
  assert.equal(recommended.units, 50);
  assert.equal(recommended.unitsPerMg, 20);
  assert.equal(res.dosesInVial, 4);
  assert.equal(res.leftoverMg, 2);
});

test("waterOptions: 12 mg vial, 2.5 mg dose, 0.5 mL syringe recommends 1.2 mL", () => {
  assert.equal(options(12, 2.5, "0.5").recommendedMl, 1.2);
});

test("waterOptions: prefers easy math over less water", () => {
  // 1.2 mL qualifies (30 units) but 1 mg = 15 units; 1.6 mL gives 1 mg = 20 units.
  assert.equal(options(8, 2).recommendedMl, 1.6);
});

test("waterOptions: falls back to the smallest qualifying amount without easy math", () => {
  const res = options(7, 2.35);
  assert.equal(res.recommendedMl, 2.8);
  const recommended = res.rows.find((r) => r.recommended);
  assert.ok(recommended);
  assert.equal(recommended.units, 94);
  assert.equal(recommended.easyMath, false);
});

test("waterOptions: row statuses and notes", () => {
  const small = options(10, 2, "0.3");
  assert.deepEqual(
    small.rows.map((r) => r.status),
    ["ok", "ok", "wont-fit", "wont-fit", "wont-fit"],
  );
  assert.equal(
    small.rows[2]?.note,
    "At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds.",
  );

  const between = options(12, 2.5);
  assert.equal(between.rows[0]?.status, "between-marks");
  assert.equal(
    between.rows[0].note,
    "At 1.0 mL, your dose is 20.8 units, between marks. The nearest mark, 20 units, gives 2.4 mg (4% under).",
  );

  const tiny = options(30, 1);
  assert.equal(tiny.rows[0]?.status, "hard-to-measure");
  assert.equal(
    tiny.rows[0].note,
    "At 1.0 mL, your dose is 3.3 units. Misreading by one mark would change it by 60%.",
  );
});

test("waterOptions: no recommendation suggests another syringe", () => {
  const res = options(30, 1);
  assert.equal(res.recommendedMl, null);
  assert.equal(
    res.rows.some((r) => r.recommended),
    false,
  );
  assert.deepEqual(res.alternative, { syringe: "0.3", waterMl: 3 });
  assert.deepEqual(codes(res.warnings), ["no-recommendation"]);
  assert.equal(
    res.warnings[0]?.message,
    "No amount from 1 to 3 mL makes a 1 mg dose easy to measure with a 1 mL syringe. A 0.3 mL syringe works with 3.0 mL of water.",
  );
});

test("waterOptions: no syringe works", () => {
  const res = options(30, 0.25);
  assert.equal(res.alternative, null);
  assert.equal(
    res.warnings[0]?.message,
    "No amount from 1 to 3 mL makes this dose easy to measure with any syringe.",
  );
});

test("waterOptions reports missing inputs and a dose bigger than the vial", () => {
  const missing = Calc.waterOptions({ vialMg: null, doseMg: 2, syringe: "1" });
  assert.deepEqual(codes(missing.errors), ["missing-vial"]);
  assert.deepEqual(missing.rows, []);
  const tooBig = options(10, 12);
  assert.deepEqual(codes(tooBig.errors), ["dose-exceeds-vial"]);
  assert.deepEqual(tooBig.rows, []);
});

test("waterOptions survives extreme inputs", () => {
  const huge = options(100000, 0.001);
  assert.equal(huge.rows.length, 5);
  assert.equal(huge.recommendedMl, null);
  assert.ok(huge.rows[0]);
  assert.equal(Calc.formatUnits(huge.rows[0].units), "less than 0.1 units");
  // A whole 0.5 mg vial as one dose: 1.0 mL is exactly 100 units, the most a 1 mL syringe holds.
  const whole = options(0.5, 0.5);
  assert.equal(whole.dosesInVial, 1);
  assert.equal(whole.recommendedMl, 1);
  assert.deepEqual(
    whole.rows.map((r) => r.status),
    ["ok", "wont-fit", "wont-fit", "wont-fit", "wont-fit"],
  );
});

// --- display edge cases found in review -----------------------------------

test("formatUnits adds decimals instead of rounding an off-mark dose to a whole number", () => {
  assert.equal(Calc.formatUnits(26.041666667), "26.04 units");
  assert.equal(Calc.formatUnits(19.95), "19.95 units");
  assert.equal(Calc.formatUnits(20.004), "20.004 units");
  assert.equal(Calc.formatUnits(20.8333), "20.8 units");
  assert.equal(Calc.formatUnits(30.000000000000004), "30 units");
});

test("formatUnits never shows an off-mark dose as a whole mark, however close it is", () => {
  assert.equal(Calc.formatUnits(20.0002), "20.0002 units");
  assert.equal(Calc.formatUnitsNumber(26.00004), "26.00004");
  assert.equal(Calc.formatMl(0.200002), "0.200002 mL");
  // Within EPS of the mark counts as on it.
  assert.equal(Calc.formatUnits(20.0000004), "20 units");
});

test("formatUnitsNumber gives the bare number for labels", () => {
  assert.equal(Calc.formatUnitsNumber(40), "40");
  assert.equal(Calc.formatUnitsNumber(19.95), "19.95");
  assert.equal(Calc.formatUnitsNumber(0.03), "<0.1");
});

test("formatMl keeps the same precision as the units it converts to", () => {
  assert.equal(Calc.formatMl(0.1995), "0.1995 mL");
  assert.equal(Calc.formatMl(0.2604166667), "0.2604 mL");
  assert.equal(Calc.formatMl(0.4), "0.40 mL");
});

test("formatMl never shows a real volume as 0.00 mL", () => {
  assert.equal(Calc.formatMl(0.0004), "less than 0.001 mL");
  assert.equal(Calc.formatMl(0), "0.00 mL");
});

test("drawForDose: worked math and nearest mark agree for a dose just off a mark", () => {
  const { result } = draw(10, 0.7, 2.85);
  assert.ok(result);
  assert.equal(result.units, 19.95);
  assert.equal(result.workedMath[2], "0.1995 mL × 100 = 19.95 units");
  assert.equal(result.nearestMarkText, "Nearest mark: 20 units = 2.857 mg (less than 1% over)");
});

test("drawForDose: a tiny dose never shows 0.00 mL", () => {
  const { result } = draw(10, 1, 0.004);
  assert.ok(result);
  assert.deepEqual(result.workedMath.slice(1), [
    "0.004 mg ÷ 10 mg/mL = less than 0.001 mL",
    "less than 0.001 mL × 100 = less than 0.1 units",
  ]);
});

test("waterOptions: a between-marks row never displays as a whole mark", () => {
  const row = options(12, 1.25).rows.find((r) => r.waterMl === 2.5);
  assert.ok(row);
  assert.equal(row.status, "between-marks");
  assert.equal(Calc.formatUnits(row.units), "26.04 units");
  assert.equal(
    row.note,
    "At 2.5 mL, your dose is 26.04 units, between marks. The nearest mark, 26 units, gives 1.248 mg (less than 1% under).",
  );
});

test("isIncompleteAmount spots text that could still become a valid amount", () => {
  for (const text of ["0", "0.", ".", "0,", "00", "0.0", " 0. "]) {
    assert.equal(Calc.isIncompleteAmount(text), true, JSON.stringify(text));
  }
  for (const text of ["", "abc", "-1", "0.5", "5 mg", "1.2.3"]) {
    assert.equal(Calc.isIncompleteAmount(text), false, JSON.stringify(text));
  }
});
```

- [ ] **Step 11: Run it to see it fail**

Run: `npx vitest run test/calc.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/calc"`.

- [ ] **Step 12: Write `src/lib/calc.ts`**

A line-for-line port of `legacy/calc.js`: the same constants, logic and messages, with named exports and types. Two mechanical changes forced by strict types, both behaviour-neutral: `checkInputs` checks `vialMg`/`doseMg` for `null` before comparing them, and `drawForDose`/`waterOptions` re-check their inputs for `null` alongside `errors.length` so TypeScript can narrow (both are already covered by `errors`).

```ts
// Reconstitution math and number formatting for the retatrutide calculator.
// Pure functions only, with no DOM access, so every number can be tested in Node.

export type SyringeKey = "0.3" | "0.5" | "1";

export interface SyringeSpec {
  key: SyringeKey;
  label: string;
  capacityMl: number;
  capacityUnits: number;
  markSpacing: number;
  labelEvery: number;
}

export type AmountField = "vialMg" | "waterMl" | "doseMg";

export type MessageCode =
  | "missing-vial"
  | "missing-water"
  | "missing-dose"
  | "dose-exceeds-vial"
  | "wont-fit"
  | "hard-to-measure"
  | "no-recommendation";

export interface CalcMessage {
  code: MessageCode;
  field?: AmountField;
  message: string;
}

export type RowStatus = "ok" | "wont-fit" | "hard-to-measure" | "between-marks";

export interface DrawInput {
  vialMg: number | null;
  waterMl: number | null;
  doseMg: number | null;
  syringe: SyringeKey;
}

export interface DrawResult {
  concentration: number;
  ml: number;
  units: number;
  unitsPerMg: number;
  onMark: boolean;
  fits: boolean;
  measurable: boolean;
  nearestMark: number;
  doseAtMarkMg: number;
  nearestMarkOff: number;
  nearestMarkText: string | null;
  dosesInVial: number;
  leftoverMg: number;
  workedMath: string[];
}

export interface DrawResponse {
  result: DrawResult | null;
  errors: CalcMessage[];
  warnings: CalcMessage[];
}

export interface MixInput {
  vialMg: number | null;
  doseMg: number | null;
  syringe: SyringeKey;
}

export interface WaterRow {
  waterMl: number;
  concentration: number;
  units: number;
  unitsPerMg: number;
  status: RowStatus;
  easyMath: boolean;
  note: string | null;
  recommended: boolean;
}

export interface WaterOptionsResponse {
  rows: WaterRow[];
  recommendedMl: number | null;
  alternative: { syringe: SyringeKey; waterMl: number } | null;
  dosesInVial: number;
  leftoverMg: number;
  errors: CalcMessage[];
  warnings: CalcMessage[];
}

interface MarkCheck {
  nearestMark: number;
  onMark: boolean;
  fits: boolean;
  measurable: boolean;
}

// Values this close to a mark or a limit count as on it (absorbs float noise).
const EPS = 1e-6;
const EASY_UNITS_PER_MG = [5, 10, 20, 25, 50, 100];
const TABLE_WATER_ML = [1, 1.5, 2, 2.5, 3];
// Candidate water amounts are built from tenths so 0.1 steps never drift.
const MIN_WATER_TENTHS = 10;
const MAX_WATER_TENTHS = 30;

export const SYRINGES: Record<SyringeKey, SyringeSpec> = {
  "0.3": {
    key: "0.3",
    label: "0.3 mL",
    capacityMl: 0.3,
    capacityUnits: 30,
    markSpacing: 1,
    labelEvery: 5,
  },
  "0.5": {
    key: "0.5",
    label: "0.5 mL",
    capacityMl: 0.5,
    capacityUnits: 50,
    markSpacing: 1,
    labelEvery: 5,
  },
  "1": {
    key: "1",
    label: "1 mL",
    capacityMl: 1,
    capacityUnits: 100,
    markSpacing: 2,
    labelEvery: 10,
  },
};
export const SYRINGE_ORDER: readonly SyringeKey[] = ["0.3", "0.5", "1"];

const MISSING: Record<AmountField, CalcMessage> = {
  vialMg: { code: "missing-vial", field: "vialMg", message: "Enter the vial amount in mg." },
  waterMl: { code: "missing-water", field: "waterMl", message: "Enter the water added in mL." },
  doseMg: { code: "missing-dose", field: "doseMg", message: "Enter your dose in mg." },
};

// --- Numbers -------------------------------------------------------------

// Strip binary float noise from computed values: 0.30000000000000004 -> 0.3.
function snap(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

// The tiny nudge makes halves like 1.005 round up despite binary representation.
function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor * (1 + 1e-12)) / factor;
}

// Shows between `min` and `max` decimal places, trimming trailing zeros.
function decimals(value: number, min: number, max: number): string {
  const text = roundTo(value, max)
    .toFixed(max)
    .replace(/\.?0+$/, "");
  if (min === 0) return text;
  const [whole = "", fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(min, "0")}`;
}

export function parseAmount(text: string | undefined): number | null {
  if (typeof text !== "string") return null;
  // "1,000" could mean 1 or 1000; guessing wrong is a 1000x dosing error.
  if (/^[1-9]\d{0,2},\d{3}$/.test(text.trim())) return null;
  const cleaned = text.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// "0", "0." or "." mid-typing can still become a valid amount like 0.5.
export function isIncompleteAmount(text: string | undefined): boolean {
  if (typeof text !== "string") return false;
  const cleaned = text.trim();
  return cleaned !== "" && /^0*[.,]?0*$/.test(cleaned);
}

// --- Formatting ----------------------------------------------------------

export function formatMg(mg: number): string {
  return `${decimals(mg, 0, 3)} mg`;
}

export function formatConcentration(mgPerMl: number): string {
  return `${decimals(mgPerMl, 0, 2)} mg/mL`;
}

// Precise enough to agree with the units it converts to (1 unit = 0.01 mL).
export function formatMl(ml: number): string {
  const units = unitsNumber(ml * 100);
  if (units === null) return "less than 0.001 mL";
  const unitPlaces = units.includes(".") ? (units.split(".")[1] ?? "").length : 0;
  return `${decimals(ml, 2, Math.max(2, unitPlaces + 2))} mL`;
}

export function formatWaterMl(ml: number): string {
  return `${decimals(ml, 1, 2)} mL`;
}

// Units as a bare number: 1 decimal, or up to 6 when fewer would show an
// off-mark dose as a whole number (26.04 must not read as the 26 mark). Six
// decimals reaches EPS, so anything further off a mark always shows as off it.
// null means a real dose too small to show.
function unitsNumber(units: number): string | null {
  if (units > 0 && roundTo(units, 1) === 0) return null;
  for (const places of [1, 2, 3, 4, 5, 6]) {
    const text = decimals(units, 0, places);
    if (text.includes(".") || Math.abs(units - Number(text)) <= EPS) return text;
  }
  return decimals(units, 0, 6);
}

export function formatUnitsNumber(units: number): string {
  return unitsNumber(units) ?? "<0.1";
}

export function formatUnits(units: number): string {
  const text = unitsNumber(units);
  if (text === null) return "less than 0.1 units";
  return `${text} ${text === "1" ? "unit" : "units"}`;
}

export function formatPercentOff(fraction: number): string {
  const direction = fraction < 0 ? "under" : "over";
  const percent = Math.round(Math.abs(fraction) * 100);
  return percent < 1 ? `less than 1% ${direction}` : `${percent}% ${direction}`;
}

export function formatDoses(count: number, leftoverMg: number): string {
  const doses = `${count} ${count === 1 ? "dose" : "doses"} in the vial`;
  return leftoverMg > 0 ? `${doses}, plus ${formatMg(leftoverMg)} left over` : doses;
}

function syringePhrase(keys: readonly SyringeKey[]): string {
  return `a ${keys.map((key) => SYRINGES[key].label).join(" or ")} syringe`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Marks and checks ----------------------------------------------------

function assess(units: number, syringe: SyringeKey): MarkCheck {
  const { markSpacing, capacityUnits } = SYRINGES[syringe];
  // Halfway doses round up to the higher mark.
  const nearestMark = Math.round(units / markSpacing + EPS) * markSpacing;
  return {
    nearestMark,
    onMark: Math.abs(units - nearestMark) <= EPS,
    fits: units <= capacityUnits + EPS,
    measurable: units >= 10 * markSpacing - EPS,
  };
}

function unitsFor(vialMg: number, doseMg: number, waterMl: number): number {
  return snap((100 * doseMg * waterMl) / vialMg);
}

function dosesInVial(vialMg: number, doseMg: number): { count: number; leftoverMg: number } {
  const count = Math.floor(vialMg / doseMg + EPS);
  const leftover = snap(vialMg - count * doseMg);
  return { count, leftoverMg: leftover > EPS ? leftover : 0 };
}

function isPositive(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

function checkInputs(
  values: Partial<Record<AmountField, number | null>>,
  required: readonly AmountField[],
): CalcMessage[] {
  const errors: CalcMessage[] = required
    .filter((field) => !isPositive(values[field]))
    .map((field) => ({ ...MISSING[field] }));
  const { vialMg, doseMg } = values;
  if (errors.length === 0 && vialMg != null && doseMg != null && doseMg > vialMg + EPS) {
    errors.push({
      code: "dose-exceeds-vial",
      message: `Your dose is more than the whole vial (${formatMg(vialMg)}).`,
    });
  }
  return errors;
}

function oneMarkPercent(units: number, syringe: SyringeKey): number {
  return Math.round((SYRINGES[syringe].markSpacing / units) * 100);
}

// --- Draw a dose ---------------------------------------------------------

function wontFitMessage(units: number, syringe: SyringeKey): string {
  const { label, capacityUnits } = SYRINGES[syringe];
  const bigger = SYRINGE_ORDER.filter((key) => {
    const other = SYRINGES[key];
    return other.capacityUnits > capacityUnits && units <= other.capacityUnits + EPS;
  });
  const draws = Math.ceil(units / capacityUnits - EPS);
  const advice = bigger.length
    ? `Use ${syringePhrase(bigger)}, or split it into ${draws} draws.`
    : `Split it into ${draws} draws.`;
  return `${formatUnits(units)} won't fit in a ${label} (${capacityUnits}-unit) syringe. ${advice}`;
}

function hardToMeasureMessage(units: number, syringe: SyringeKey): string {
  const finer = SYRINGE_ORDER.filter((key) => {
    const other = assess(units, key);
    return key !== syringe && other.fits && other.measurable;
  });
  const advice = finer.length
    ? `${capitalize(syringePhrase(finer))} reads more finely.`
    : "Mixing your next vial with more water makes each dose bigger and easier to measure.";
  const spacing = formatUnits(SYRINGES[syringe].markSpacing);
  return `Each mark on this syringe is ${spacing}, so misreading by one mark changes this dose by ${oneMarkPercent(units, syringe)}%. ${advice}`;
}

export function drawForDose({ vialMg, waterMl, doseMg, syringe }: DrawInput): DrawResponse {
  const errors = checkInputs({ vialMg, waterMl, doseMg }, ["vialMg", "waterMl", "doseMg"]);
  if (errors.length || vialMg == null || waterMl == null || doseMg == null) {
    return { result: null, errors, warnings: [] };
  }

  const concentration = snap(vialMg / waterMl);
  const ml = snap((doseMg * waterMl) / vialMg);
  const units = unitsFor(vialMg, doseMg, waterMl);
  const check = assess(units, syringe);
  const doseAtMarkMg = snap((check.nearestMark * vialMg) / (100 * waterMl));
  const nearestMarkOff = (doseAtMarkMg - doseMg) / doseMg;
  const doses = dosesInVial(vialMg, doseMg);
  const showNearest = check.fits && !check.onMark && check.nearestMark > 0;

  const warnings: CalcMessage[] = [];
  if (!check.fits) {
    errors.push({ code: "wont-fit", message: wontFitMessage(units, syringe) });
  } else if (!check.measurable) {
    warnings.push({ code: "hard-to-measure", message: hardToMeasureMessage(units, syringe) });
  }

  return {
    result: {
      concentration,
      ml,
      units,
      unitsPerMg: snap((100 * waterMl) / vialMg),
      onMark: check.onMark,
      fits: check.fits,
      measurable: check.measurable,
      nearestMark: check.nearestMark,
      doseAtMarkMg,
      nearestMarkOff,
      nearestMarkText: showNearest
        ? `Nearest mark: ${formatUnits(check.nearestMark)} = ${formatMg(doseAtMarkMg)} (${formatPercentOff(nearestMarkOff)})`
        : null,
      dosesInVial: doses.count,
      leftoverMg: doses.leftoverMg,
      workedMath: [
        `${formatMg(vialMg)} ÷ ${formatWaterMl(waterMl)} = ${formatConcentration(concentration)}`,
        `${formatMg(doseMg)} ÷ ${formatConcentration(concentration)} = ${formatMl(ml)}`,
        `${formatMl(ml)} × 100 = ${formatUnits(units)}`,
      ],
    },
    errors,
    warnings,
  };
}

// --- Mix a vial ----------------------------------------------------------

function rowNote(
  status: RowStatus,
  waterMl: number,
  units: number,
  check: MarkCheck,
  vialMg: number,
  doseMg: number,
  syringe: SyringeKey,
): string | null {
  const at = `At ${formatWaterMl(waterMl)}, your dose is ${formatUnits(units)}`;
  if (status === "wont-fit") return `${at}, more than a ${SYRINGES[syringe].label} syringe holds.`;
  if (status === "hard-to-measure") {
    return `${at}. Misreading by one mark would change it by ${oneMarkPercent(units, syringe)}%.`;
  }
  if (status === "between-marks") {
    const doseAtMarkMg = snap((check.nearestMark * vialMg) / (100 * waterMl));
    const off = formatPercentOff((doseAtMarkMg - doseMg) / doseMg);
    return `${at}, between marks. The nearest mark, ${formatUnits(check.nearestMark)}, gives ${formatMg(doseAtMarkMg)} (${off}).`;
  }
  return null;
}

function evaluateWater(
  vialMg: number,
  doseMg: number,
  waterMl: number,
  syringe: SyringeKey,
): Omit<WaterRow, "recommended"> {
  const units = unitsFor(vialMg, doseMg, waterMl);
  const unitsPerMg = snap((100 * waterMl) / vialMg);
  const check = assess(units, syringe);
  let status: RowStatus = "ok";
  if (!check.fits) status = "wont-fit";
  else if (!check.measurable) status = "hard-to-measure";
  else if (!check.onMark) status = "between-marks";
  return {
    waterMl,
    concentration: snap(vialMg / waterMl),
    units,
    unitsPerMg,
    status,
    easyMath: EASY_UNITS_PER_MG.some((easy) => Math.abs(easy - unitsPerMg) <= EPS),
    note: rowNote(status, waterMl, units, check, vialMg, doseMg, syringe),
  };
}

function recommendWater(vialMg: number, doseMg: number, syringe: SyringeKey): number | null {
  const qualifying: Omit<WaterRow, "recommended">[] = [];
  for (let tenths = MIN_WATER_TENTHS; tenths <= MAX_WATER_TENTHS; tenths++) {
    const option = evaluateWater(vialMg, doseMg, tenths / 10, syringe);
    if (option.status === "ok") qualifying.push(option);
  }
  const easy = qualifying.filter((option) => option.easyMath);
  const pick = (easy.length ? easy : qualifying)[0];
  return pick?.waterMl ?? null;
}

function noRecommendationMessage(
  doseMg: number,
  syringe: SyringeKey,
  alternative: WaterOptionsResponse["alternative"],
): string {
  if (!alternative) {
    return "No amount from 1 to 3 mL makes this dose easy to measure with any syringe.";
  }
  return (
    `No amount from 1 to 3 mL makes a ${formatMg(doseMg)} dose easy to measure with a ${SYRINGES[syringe].label} syringe. ` +
    `${capitalize(syringePhrase([alternative.syringe]))} works with ${formatWaterMl(alternative.waterMl)} of water.`
  );
}

export function waterOptions({ vialMg, doseMg, syringe }: MixInput): WaterOptionsResponse {
  const errors = checkInputs({ vialMg, doseMg }, ["vialMg", "doseMg"]);
  if (errors.length || vialMg == null || doseMg == null) {
    return {
      rows: [],
      recommendedMl: null,
      alternative: null,
      dosesInVial: 0,
      leftoverMg: 0,
      errors,
      warnings: [],
    };
  }

  const recommendedMl = recommendWater(vialMg, doseMg, syringe);
  const amounts = [...TABLE_WATER_ML];
  if (recommendedMl !== null && !amounts.includes(recommendedMl)) amounts.push(recommendedMl);
  amounts.sort((a, b) => a - b);
  const rows = amounts.map((waterMl) => ({
    ...evaluateWater(vialMg, doseMg, waterMl, syringe),
    recommended: waterMl === recommendedMl,
  }));

  const warnings: CalcMessage[] = [];
  let alternative: WaterOptionsResponse["alternative"] = null;
  if (recommendedMl === null) {
    for (const key of SYRINGE_ORDER) {
      if (key === syringe) continue;
      const waterMl = recommendWater(vialMg, doseMg, key);
      if (waterMl !== null) {
        alternative = { syringe: key, waterMl };
        break;
      }
    }
    warnings.push({
      code: "no-recommendation",
      message: noRecommendationMessage(doseMg, syringe, alternative),
    });
  }

  const doses = dosesInVial(vialMg, doseMg);
  return {
    rows,
    recommendedMl,
    alternative,
    dosesInVial: doses.count,
    leftoverMg: doses.leftoverMg,
    errors,
    warnings,
  };
}

export function measureWater(
  waterMl: number,
  syringe: SyringeKey,
): { fullSyringes: number; remainderUnits: number } {
  const { capacityMl } = SYRINGES[syringe];
  const fullSyringes = Math.floor(waterMl / capacityMl + EPS);
  const remainder = snap((waterMl - fullSyringes * capacityMl) * 100);
  return { fullSyringes, remainderUnits: remainder > EPS ? remainder : 0 };
}

export function describeWaterMeasure(waterMl: number, syringe: SyringeKey): string {
  const { fullSyringes, remainderUnits } = measureWater(waterMl, syringe);
  if (fullSyringes === 0) return `Draw to ${formatUnits(remainderUnits)}`;
  const full = `${fullSyringes} full ${fullSyringes === 1 ? "syringe" : "syringes"}`;
  return remainderUnits > 0 ? `${full} + ${formatUnits(remainderUnits)}` : full;
}
```

- [ ] **Step 13: Run the calc tests**

Run: `npx vitest run test/calc.test.ts`
Expected: PASS, `Tests  47 passed (47)`.

- [ ] **Step 14: Format and run the whole check**

```bash
npm run format
npm run check
```

Expected: `tsc -b` silent, ESLint silent, `All matched files use Prettier code style!`, `Tests  47 passed (47)`, `✓ built in …`. If `npm run format` changed any file you wrote above, that's fine; commit the formatted version.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "Set up Vite, React and TypeScript; port calc to typed module

The old static app moves to legacy/ for side-by-side comparison.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Syringe geometry and text helpers

Port the geometry half of `syringe.js` (no SVG strings) and pull the two text helpers out of `app.js`.

**Files:**
- Create: `src/lib/syringe.ts`, `src/lib/text.ts`, `test/syringe.test.ts`, `test/text.test.ts`

**Interfaces:**
- Consumes: from `@/lib/calc`: `SYRINGES`, `formatUnits`, `formatUnitsNumber`, `type SyringeKey`.
- Produces: `@/lib/syringe` and `@/lib/text` as listed in "Interfaces used across tasks".

- [ ] **Step 1: Write the failing syringe test**

`test/syringe.test.ts`: the `unitToY`, `syringePosition` and `describeSyringe` tests are ported unchanged from `legacy/test/syringe.test.js`. The two `renderSyringe` markup tests become `scaleMarks` tests, because markup now lives in a React component. The markup checks themselves come back as a `SyringeDiagram` component test in Task 4. Tick counts are the same: 31/51/51 ticks and 7/11/11 labelled ticks.

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import * as Syringe from "@/lib/syringe";

test("unitToY maps 0 to the top of the scale and capacity to the bottom", () => {
  assert.equal(Syringe.unitToY(0, "1"), 82);
  assert.equal(Syringe.unitToY(100, "1"), 502);
  assert.equal(Syringe.unitToY(25, "0.5"), 292);
  assert.equal(Syringe.unitToY(15, "0.3"), 292);
});

test("unitToY clamps values outside the syringe", () => {
  assert.equal(Syringe.unitToY(150, "1"), 502);
  assert.equal(Syringe.unitToY(-5, "1"), 82);
});

test("syringePosition for each state", () => {
  assert.deepEqual(Syringe.syringePosition({ syringe: "1", units: 20, state: "ok" }), {
    fillScale: 0.2,
    offset: 84,
    label: "20",
  });
  assert.deepEqual(Syringe.syringePosition({ syringe: "1", units: 150, state: "overflow" }), {
    fillScale: 1,
    offset: 420,
    label: "",
  });
  assert.deepEqual(Syringe.syringePosition({ syringe: "0.3", units: 0, state: "empty" }), {
    fillScale: 0,
    offset: 0,
    label: "",
  });
  assert.equal(Syringe.syringePosition({ syringe: "1", units: 22.5, state: "ok" }).label, "22.5");
});

test("describeSyringe gives the accessible label", () => {
  assert.equal(
    Syringe.describeSyringe({ syringe: "1", units: 20, state: "ok" }),
    "1 mL syringe drawn to 20 units",
  );
  assert.equal(
    Syringe.describeSyringe({ syringe: "0.3", units: 0, state: "empty" }),
    "0.3 mL syringe, empty",
  );
  assert.equal(
    Syringe.describeSyringe({ syringe: "0.5", units: 60, state: "overflow" }),
    "0.5 mL syringe, dose doesn't fit",
  );
});

test("scaleMarks gives the right ticks and labels for each syringe", () => {
  const expected = { "0.3": [31, 7], "0.5": [51, 11], "1": [51, 11] } as const;
  for (const [syringe, [ticks, labels]] of Object.entries(expected)) {
    const marks = Syringe.scaleMarks(syringe as keyof typeof expected);
    assert.equal(marks.length, ticks, `${syringe} ticks`);
    assert.equal(marks.filter((mark) => mark.major).length, labels, `${syringe} major ticks`);
  }
});

test("scaleMarks runs from the top of the scale to the bottom", () => {
  const marks = Syringe.scaleMarks("1");
  assert.deepEqual(marks[0], { units: 0, y: 82, major: true });
  assert.deepEqual(marks[1], { units: 2, y: 90.4, major: false });
  assert.deepEqual(marks.at(-1), { units: 100, y: 502, major: true });
});

test("syringePosition labels a tiny dose with a number, not a word", () => {
  assert.equal(Syringe.syringePosition({ syringe: "1", units: 0.03, state: "ok" }).label, "<0.1");
  assert.equal(Syringe.syringePosition({ syringe: "1", units: 19.95, state: "ok" }).label, "19.95");
});
```

- [ ] **Step 2: Write the failing text test**

`test/text.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { glueUnits, splitFigure } from "@/lib/text";

const NBSP = "\u00a0";

test("glueUnits joins a number to its unit with a non-breaking space", () => {
  assert.equal(glueUnits("Draw to 20 units"), `Draw to 20${NBSP}units`);
  assert.equal(glueUnits("1 unit"), `1${NBSP}unit`);
  assert.equal(glueUnits("0.40 mL at 5 mg/mL"), `0.40${NBSP}mL at 5${NBSP}mg/mL`);
  assert.equal(glueUnits("2 mg ÷ 5 mg/mL"), `2${NBSP}mg ÷ 5${NBSP}mg/mL`);
  assert.equal(glueUnits("less than 0.1 units"), `less than 0.1${NBSP}units`);
});

test("glueUnits leaves words and other units alone", () => {
  assert.equal(glueUnits("Enter the vial amount in mg."), "Enter the vial amount in mg.");
  assert.equal(glueUnits("2 mgs"), "2 mgs");
  assert.equal(glueUnits("2 mg/kg"), "2 mg/kg");
  assert.equal(glueUnits("5 doses in the vial"), "5 doses in the vial");
});

test("splitFigure separates the number from its unit", () => {
  assert.deepEqual(splitFigure("40 units"), { number: "40", unit: "units" });
  assert.deepEqual(splitFigure("1.5 mL"), { number: "1.5", unit: "mL" });
  assert.deepEqual(splitFigure("22.5 units"), { number: "22.5", unit: "units" });
});

test("splitFigure returns null when the text doesn't start with a number", () => {
  assert.equal(splitFigure("less than 0.1 units"), null);
  assert.equal(splitFigure("40"), null);
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/syringe.test.ts test/text.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/syringe"` and `"@/lib/text"`.

- [ ] **Step 4: Write `src/lib/syringe.ts`**

Same constants and maths as `legacy/syringe.js`; `scaleMarkup`'s loop becomes `scaleMarks`, which returns numbers instead of markup.

```ts
// Geometry for the upright U-100 syringe drawing. Numbers only; SyringeDiagram draws it.
import { SYRINGES, formatUnits, formatUnitsNumber, type SyringeKey } from "@/lib/calc";

export type SyringeState = "ok" | "overflow" | "empty";

export interface SyringeView {
  syringe: SyringeKey;
  units: number;
  state: SyringeState;
}

export interface ScaleMark {
  units: number;
  y: number;
  major: boolean;
}

// Geometry in SVG user units. The needle points up; 0 units is the top of the barrel.
export const VIEW_WIDTH = 124;
export const VIEW_HEIGHT = 580;
export const CENTER_X = 60;
export const BARREL_LEFT = 42;
export const BARREL_RIGHT = 78;
export const BARREL_TOP = 80;
export const SCALE_TOP = 82;
export const SCALE_LENGTH = 420;
export const BARREL_BOTTOM = SCALE_TOP + SCALE_LENGTH + 24;
export const STOPPER_HEIGHT = 14;
export const THUMB_TOP = VIEW_HEIGHT - 14;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function unitToY(units: number, syringe: SyringeKey): number {
  const capacity = SYRINGES[syringe].capacityUnits;
  const clamped = Math.min(Math.max(units, 0), capacity);
  return round3(SCALE_TOP + (clamped / capacity) * SCALE_LENGTH);
}

// Where the moving parts sit. Overflow parks the stopper at capacity.
export function syringePosition({ syringe, units, state }: SyringeView): {
  fillScale: number;
  offset: number;
  label: string;
} {
  const capacity = SYRINGES[syringe].capacityUnits;
  const drawn = state === "empty" ? 0 : state === "overflow" ? capacity : units;
  const offset = round3(unitToY(drawn, syringe) - SCALE_TOP);
  return {
    fillScale: round3(offset / SCALE_LENGTH),
    offset,
    label: state === "ok" ? formatUnitsNumber(units) : "",
  };
}

export function describeSyringe({ syringe, units, state }: SyringeView): string {
  const { label } = SYRINGES[syringe];
  if (state === "empty") return `${label} syringe, empty`;
  if (state === "overflow") return `${label} syringe, dose doesn't fit`;
  return `${label} syringe drawn to ${formatUnits(units)}`;
}

// One entry per tick, from 0 to capacity; labelled ticks are major.
export function scaleMarks(syringe: SyringeKey): ScaleMark[] {
  const { capacityUnits, markSpacing, labelEvery } = SYRINGES[syringe];
  const marks: ScaleMark[] = [];
  for (let units = 0; units <= capacityUnits; units += markSpacing) {
    marks.push({ units, y: unitToY(units, syringe), major: units % labelEvery === 0 });
  }
  return marks;
}
```

- [ ] **Step 5: Write `src/lib/text.ts`**

The regex is copied from `legacy/app.js` (`glueUnits`) and `bigFigure` (`splitFigure`). Write the non-breaking space as `\u00a0`.

```ts
// A non-breaking space keeps "20 units" from wrapping into "20" / "units".
export function glueUnits(text: string): string {
  return text.replace(/(\d) (units?|mg\/mL|mL|mg)(?![\w/])/g, "$1\u00a0$2");
}

// "40 units" -> { number: "40", unit: "units" }, so the answer can size them apart.
// null when the text doesn't start with a number, such as "less than 0.1 units".
export function splitFigure(text: string): { number: string; unit: string } | null {
  const match = /^([\d.]+) (.+)$/.exec(text);
  if (!match?.[1] || !match[2]) return null;
  return { number: match[1], unit: match[2] };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS, `Test Files  3 passed (3)`, `Tests  58 passed (58)`.

- [ ] **Step 7: Check and commit**

```bash
npm run format
npm run check
git add -A
git commit -m "Port syringe geometry and text helpers to TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected from `npm run check`: all silent/green, `Tests  58 passed (58)`.

---

### Task 3: Theme, shadcn primitives and the inputs

Add the clinical theme, the shadcn primitives the inputs need, and the input side of the page: masthead with mode tabs, amount fields, syringe picker. **Before writing any UI in Tasks 3–6, load the `frontend-design:frontend-design` skill** (a standing instruction for this repo). The spec already fixes the visual direction; follow it.

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/AmountField.tsx`, `src/components/SyringePicker.tsx`, `src/components/ModeTabs.tsx`, `test/App.test.tsx`
- Modify: `src/index.css` (replace), `src/main.tsx` (replace), `src/App.tsx` (replace)

**Interfaces:**
- Consumes: `@/lib/calc` (`parseAmount`, `isIncompleteAmount`, `waterOptions`, `drawForDose`, `SYRINGES`, `SYRINGE_ORDER`, types); `@/lib/text` (`glueUnits`, used by the test helper).
- Produces:
  - `AmountField({ id, label, unit, value, error: string | undefined, onChange(value: string) })`
  - `SyringePicker({ value: SyringeKey, onChange(value: SyringeKey) })`, rendered as a Radix radio group labelled "Syringe"
  - `ModeTabs({ mode: Mode, onModeChange(mode: Mode), children })` and `type Mode = "mix" | "draw"`
  - Tailwind utilities from the theme: `text-sm|base|lg|xl|2xl|answer`, `font-sans|mono`, colours `background, foreground, muted, muted-foreground, border, input, ring, destructive, draw`, and the `narrow:` variant (`max-width: 480px`)
  - `test/App.test.tsx` with a `setup()` helper returning `{ user, answer, syringe, waterRadio, row, type }`. Later tasks append tests that use these helpers.

- [ ] **Step 1: Install the UI dependencies**

```bash
npm install radix-ui@^1.6.7 class-variance-authority@^0.7.1 cn@^0.4.0 \
  @fontsource/atkinson-hyperlegible-next@^5.3.0 @fontsource/ibm-plex-mono@^5.3.0
npm install -D shadcn@^4.21.0
```

`cn` is shadcn's own class-merging package (`github.com/shadcn-ui/cn`), a drop-in for `clsx` + `tailwind-merge`. `shadcn` is a dev dependency because only its `shadcn/tailwind.css` (custom variants such as `data-active:`) is used, at build time.

- [ ] **Step 2: Write the failing input tests**

`test/App.test.tsx`. The `setup()` helper already includes the helpers Tasks 4 and 5 use; `waterRadio` builds accessible names with `glueUnits` because Testing Library doesn't normalise the non-breaking space in accessible names.

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "@/App";
import { glueUnits } from "@/lib/text";

function setup() {
  const user = userEvent.setup();
  render(<App />);
  const answer = () => screen.getByRole("region", { name: "Answer" });
  const syringe = () => screen.getByRole("img");
  // Water amounts are glued to their unit with a non-breaking space, as on the page.
  const waterRadio = (water: string) => screen.getByRole("radio", { name: glueUnits(water) });
  const row = (water: string) => {
    const tr = waterRadio(water).closest("tr");
    if (!tr) throw new Error(`No row for ${water}`);
    return tr;
  };
  const type = async (label: string, text: string) => {
    await user.type(screen.getByLabelText(label), text);
  };
  return { user, answer, syringe, waterRadio, row, type };
}

// --- inputs ----------------------------------------------------------

test("switching tabs keeps the vial and dose", async () => {
  const { user, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(screen.getByLabelText("Water added")).toHaveValue("");
  expect(screen.getByLabelText("Vial")).toHaveValue("10");
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(screen.getByLabelText("Vial")).toHaveValue("10");
  expect(screen.getByLabelText("Your dose")).toHaveValue("2");
});

test("water typed in Draw is still there after a trip to Mix", async () => {
  const { user, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Water added", "2");
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(screen.queryByLabelText("Water added")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(screen.getByLabelText("Water added")).toHaveValue("2");
});

test("half-typed numbers stay calm; text that can't be a number shows an error", async () => {
  const { user, type } = setup();
  const vial = screen.getByLabelText("Vial");
  await type("Vial", "0.");
  expect(vial).toHaveAttribute("aria-invalid", "false");
  expect(screen.queryByText("Enter the vial amount in mg.")).not.toBeInTheDocument();
  await user.clear(vial);
  await type("Vial", "abc");
  expect(vial).toHaveAttribute("aria-invalid", "true");
  expect(vial).toHaveAccessibleDescription("Enter the vial amount in mg.");
});

test("pressing the chosen syringe again keeps it chosen", async () => {
  const { user } = setup();
  const oneMl = screen.getByRole("radio", { name: "1 mL" });
  expect(oneMl).toHaveAttribute("aria-checked", "true");
  await user.click(oneMl);
  expect(oneMl).toHaveAttribute("aria-checked", "true");
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run test/App.test.tsx`
Expected: FAIL, 4 tests, e.g. `Unable to find a label with the text of: Vial` (the placeholder page has no fields).

- [ ] **Step 4: Add shadcn configuration and `cn`**

`components.json` (lets `npx shadcn@latest add <name>` work later; `radix-lyra` is the sharp-cornered Radix style):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-lyra",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "phosphor",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

`src/lib/utils.ts`:

```ts
export { cn } from "cn";
```

- [ ] **Step 5: Add the shadcn primitives**

These are the files `shadcn@4.21.0 add toggle toggle-group tabs input label` generates for the `radix-lyra` style, formatted by Prettier, with one fix in `toggle-group.tsx`: `||` → `??` in four places (the strict ESLint preset flags `||` on nullable values). Write them as given rather than running the CLI, so the result doesn't depend on the live registry.

`src/components/ui/toggle.tsx`:

```tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Toggle as TogglePrimitive } from "radix-ui";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-none text-xs font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-none px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
```

`src/components/ui/toggle-group.tsx`:

```tsx
import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
});

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-none data-[size=sm]:rounded-none data-vertical:flex-col data-vertical:items-stretch",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant ?? variant}
      data-size={context.size ?? size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-none group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-none group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-none group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-none group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant ?? variant,
          size: context.size ?? size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
```

`src/components/ui/tabs.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-none p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-none border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:py-[calc(--spacing(1.25))] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-xs/relaxed outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
```

`src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
```

`src/components/ui/label.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "cn";
import { Label as LabelPrimitive } from "radix-ui";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
```

- [ ] **Step 6: Replace `src/index.css` with the clinical theme**

Colour values are the spec's starting tokens (all text passes WCAG AA in both themes; `draw` is 3.2:1 on the light background and 7.1:1 on dark). `barrel` and `rod` are two extra syringe-only tokens carried over from `styles.css`. The type scale is 14/17/21/27/34/54px.

```css
@import "tailwindcss";
@import "shadcn/tailwind.css";

/* Phones where the table drops its Strength column (the answer already shows it). */
@custom-variant narrow (@media (max-width: 480px));

@theme {
  /* 14 / 17 / 21 / 27 / 34 / 54: a major-third scale around a 17px body. */
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.35;
  --text-base: 1.0625rem;
  --text-base--line-height: 1.45;
  --text-lg: 1.3125rem;
  --text-lg--line-height: 1.3;
  --text-xl: 1.6875rem;
  --text-xl--line-height: 1.2;
  --text-2xl: 2.125rem;
  --text-2xl--line-height: 1.1;
  --text-answer: 3.375rem;
  --text-answer--line-height: 1;
}

@theme inline {
  --font-sans: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --color-draw: var(--draw);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
}

:root {
  --radius: 0.25rem;
  --background: #fafbfc;
  --foreground: #0b1b26;
  --muted: #eef3f6;
  --muted-foreground: #52616b;
  --border: #d5dde3;
  --input: #d5dde3;
  --ring: #0b1b26;
  --destructive: #b3261e;
  /* Orange only ever means "this is the amount to use". Never text. */
  --draw: #f25c05;
  /* Syringe only. */
  --solution: #dcebf3;
  --stopper: #1f2429;
  --barrel: #ffffff;
  --rod: #c9d2d8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0e1418;
    --foreground: #e6edf1;
    --muted: #18222a;
    --muted-foreground: #93a3ad;
    --border: #26323b;
    --input: #26323b;
    --ring: #e6edf1;
    --destructive: #ff8a80;
    --draw: #ff7a2e;
    --solution: #1f3b4a;
    --stopper: #aeb8bf;
    --barrel: #151d22;
    --rod: #4a5963;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    color-scheme: light dark;
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-background font-sans text-base text-foreground tabular-nums;
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 7: Replace `src/main.tsx` to load the fonts**

```tsx
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Write the input components**

`src/components/AmountField.tsx`:

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AmountFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

// A number set like an instrument readout on an underline, with its unit beside it.
export function AmountField({ id, label, unit, value, error, onChange }: AmountFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-base leading-normal font-semibold">
        {label}
      </Label>
      <div className="flex max-w-[10em] items-baseline border-b-2 border-foreground focus-within:shadow-[0_2px_0_0_var(--color-foreground)] has-[input[aria-invalid=true]]:border-destructive">
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-auto rounded-none border-0 bg-transparent px-0 py-1 font-mono text-xl font-semibold shadow-none focus-visible:ring-0 aria-invalid:ring-0 md:text-xl dark:bg-transparent"
        />
        <span className="pl-1.5 text-muted-foreground">{unit}</span>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

`src/components/SyringePicker.tsx`:

```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SYRINGE_ORDER, SYRINGES, type SyringeKey } from "@/lib/calc";

function isSyringeKey(value: string): value is SyringeKey {
  return (SYRINGE_ORDER as readonly string[]).includes(value);
}

interface SyringePickerProps {
  value: SyringeKey;
  onChange: (value: SyringeKey) => void;
}

export function SyringePicker({ value, onChange }: SyringePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <span id="syringe-label" className="font-semibold">
        Syringe
      </span>
      <ToggleGroup
        type="single"
        value={value}
        // Radix reports "" when the active item is pressed again; there is always a syringe.
        onValueChange={(next) => {
          if (isSyringeKey(next)) onChange(next);
        }}
        aria-labelledby="syringe-label"
        variant="outline"
        spacing={0}
        className="w-full max-w-[18em]"
      >
        {SYRINGE_ORDER.map((key) => (
          <ToggleGroupItem
            key={key}
            value={key}
            className="h-11 flex-1 border-foreground px-1 text-base font-semibold data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground"
          >
            {SYRINGES[key].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
```

`src/components/ModeTabs.tsx`:

```tsx
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type Mode = "mix" | "draw";

function isMode(value: string): value is Mode {
  return value === "mix" || value === "draw";
}

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  children: ReactNode;
}

// The masthead and the mode switch. Both modes share one panel; all values live in App.
export function ModeTabs({ mode, onModeChange, children }: ModeTabsProps) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (isMode(value)) onModeChange(value);
      }}
      className="gap-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <h1 className="text-lg font-bold sm:text-xl">Retatrutide</h1>
        <TabsList variant="line" className="h-auto gap-5 p-0">
          <TabsTrigger
            value="mix"
            className="flex-none px-0 py-1 text-base font-semibold text-muted-foreground data-active:text-foreground"
          >
            Mix a vial
          </TabsTrigger>
          <TabsTrigger
            value="draw"
            className="flex-none px-0 py-1 text-base font-semibold text-muted-foreground data-active:text-foreground"
          >
            Draw a dose
          </TabsTrigger>
        </TabsList>
      </header>
      <TabsContent value={mode} className="text-base">
        {children}
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 9: Replace `src/App.tsx`**

State lives here. Both results are derived on every render, and field errors come from whichever mode is showing.

```tsx
import { useMemo, useState } from "react";
import { AmountField } from "@/components/AmountField";
import { ModeTabs, type Mode } from "@/components/ModeTabs";
import { SyringePicker } from "@/components/SyringePicker";
import {
  drawForDose,
  isIncompleteAmount,
  parseAmount,
  waterOptions,
  type AmountField as Field,
  type CalcMessage,
  type SyringeKey,
} from "@/lib/calc";

type AmountText = Record<Field, string>;

// Field errors appear only once something invalid is typed, so an empty form
// stays calm and "0." on the way to "0.5" doesn't flash red.
function visibleError(field: Field, text: string, errors: CalcMessage[]): string | undefined {
  const error = errors.find((e) => e.field === field);
  if (!error || text.trim() === "" || isIncompleteAmount(text)) return undefined;
  return error.message;
}

export function App() {
  const [mode, setMode] = useState<Mode>("mix");
  const [text, setText] = useState<AmountText>({ vialMg: "", waterMl: "", doseMg: "" });
  const [syringe, setSyringe] = useState<SyringeKey>("1");

  const values = useMemo(
    () => ({
      vialMg: parseAmount(text.vialMg),
      waterMl: parseAmount(text.waterMl),
      doseMg: parseAmount(text.doseMg),
      syringe,
    }),
    [text, syringe],
  );
  const mix = useMemo(() => waterOptions(values), [values]);
  const draw = useMemo(() => drawForDose(values), [values]);

  const errors = mode === "mix" ? mix.errors : draw.errors;

  function changeText(field: Field, value: string) {
    setText((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-5 pb-10 sm:pt-10">
      <ModeTabs mode={mode} onModeChange={setMode}>
        <div className="flex min-w-0 flex-col gap-5">
          <AmountField
            id="vial"
            label="Vial"
            unit="mg"
            value={text.vialMg}
            error={visibleError("vialMg", text.vialMg, errors)}
            onChange={(value) => {
              changeText("vialMg", value);
            }}
          />
          {mode === "draw" && (
            <AmountField
              id="water"
              label="Water added"
              unit="mL"
              value={text.waterMl}
              error={visibleError("waterMl", text.waterMl, errors)}
              onChange={(value) => {
                changeText("waterMl", value);
              }}
            />
          )}
          <AmountField
            id="dose"
            label="Your dose"
            unit="mg"
            value={text.doseMg}
            error={visibleError("doseMg", text.doseMg, errors)}
            onChange={(value) => {
              changeText("doseMg", value);
            }}
          />
          <SyringePicker value={syringe} onChange={setSyringe} />
        </div>
      </ModeTabs>
      <footer className="mt-10 max-w-[40em] text-sm text-muted-foreground">
        This does arithmetic only. Check your numbers with your prescriber or pharmacist.
      </footer>
    </main>
  );
}
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run`
Expected: PASS, `Test Files  4 passed (4)`, `Tests  62 passed (62)`.

- [ ] **Step 11: Look at it**

Run `npm run dev` and open http://localhost:5173 at a phone width (390px). Expected: "Retatrutide" with "Mix a vial" / "Draw a dose" tabs, underlined fields with large monospace numbers, the joined 0.3 / 0.5 / 1 mL picker with 1 mL filled in ink. Stop the server.

- [ ] **Step 12: Check and commit**

```bash
npm run format
npm run check
git add -A
git commit -m "Add clinical theme, shadcn primitives and the input controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected from `npm run check`: all green, `Tests  62 passed (62)`.

---

### Task 4: The answer and the syringe

Show the answer for both modes and draw the syringe. The water table and worked math come in Task 5, so in this task Mix always shows the recommended row.

**Files:**
- Create: `src/components/Notices.tsx`, `src/components/AnswerCard.tsx`, `src/components/SyringeDiagram.tsx`
- Modify: `src/index.css` (append syringe styles), `src/App.tsx` (replace), `test/App.test.tsx` (append tests)
- Test: `test/SyringeDiagram.test.tsx` (new)

**Interfaces:**
- Consumes: `@/lib/calc` (formatters, `describeWaterMeasure`, response types), `@/lib/syringe` (geometry, `syringePosition`, `describeSyringe`, `scaleMarks`, `SyringeView`), `@/lib/text` (`glueUnits`, `splitFigure`).
- Produces:
  - `Notices({ messages: string[] })`
  - `AnswerCard` with props `{ mode: "mix"; response: WaterOptionsResponse; selected: WaterRow | null; syringe: SyringeKey } | { mode: "draw"; response: DrawResponse }`, rendered as `<section aria-label="Answer" aria-live="polite">`
  - `SyringeDiagram(view: SyringeView)`: a `<figure>` with `<svg role="img" data-state=… key={syringe}>` and the caption

- [ ] **Step 1: Append the failing answer and syringe tests to `test/App.test.tsx`**

Add these after the last test in the file:

```tsx
// --- answer and syringe ----------------------------------------------

test("mix: 10 mg vial, 2 mg dose on a 1 mL syringe answers 1.0 mL", async () => {
  const { answer, syringe, type } = setup();
  expect(answer()).toHaveTextContent("Enter your vial and dose to see how much water to add.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe, empty");
  await type("Vial", "10");
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Add 1.0 mL of bacteriostatic water");
  expect(answer()).toHaveTextContent("Measure: 1 full syringe");
  expect(answer()).toHaveTextContent("Makes 10 mg/mL. Your dose: 20 units.");
  expect(answer()).toHaveTextContent("5 doses in the vial.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe drawn to 20 units");
  expect(syringe()).toHaveAttribute("data-state", "ok");
});

test("draw: a dose that won't fit shows the message and the overflow state", async () => {
  const { user, answer, syringe, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(answer()).toHaveTextContent("Enter your vial, water and dose to see where to draw.");
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Draw to 40 units");
  expect(answer()).toHaveTextContent("0.40 mL at 5 mg/mL. 5 doses in the vial.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe drawn to 40 units");

  await user.click(screen.getByRole("radio", { name: "0.3 mL" }));
  expect(answer()).toHaveTextContent(
    "40 units won't fit in a 0.3 mL (30-unit) syringe. Use a 0.5 mL or 1 mL syringe, or split it into 2 draws.",
  );
  expect(syringe()).toHaveAttribute("data-state", "overflow");
  expect(syringe()).toHaveAccessibleName("0.3 mL syringe, dose doesn't fit");
});

test("draw: a dose bigger than the vial shows a general error and an empty syringe", async () => {
  const { user, answer, syringe, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "12");
  expect(answer()).toHaveTextContent("Your dose is more than the whole vial (10 mg).");
  expect(syringe()).toHaveAttribute("data-state", "empty");
});

test("the syringe keeps its drawing while the dose changes, and redraws for a new size", async () => {
  const { user, syringe, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  const drawing = syringe();
  expect(drawing).toHaveAccessibleName("1 mL syringe drawn to 20 units");
  await user.clear(screen.getByLabelText("Your dose"));
  await type("Your dose", "3");
  expect(syringe()).toBe(drawing);
  expect(drawing).toHaveAccessibleName("1 mL syringe drawn to 30 units");
  await user.click(screen.getByRole("radio", { name: "0.5 mL" }));
  expect(syringe()).not.toBe(drawing);
});
```

Then create `test/SyringeDiagram.test.tsx`. These are the markup checks from the old `renderSyringe` test (fill scale, plunger and draw-line offsets, label, `data-syringe`), now on the component, so no assertion is lost in the port:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SyringeDiagram } from "@/components/SyringeDiagram";

// The markup checks from the old renderSyringe test, on the React component.
test("SyringeDiagram draws the fill, plunger, draw line and label at the dose", () => {
  const { container } = render(<SyringeDiagram syringe="1" units={20} state="ok" />);
  const svg = screen.getByRole("img", { name: "1 mL syringe drawn to 20 units" });
  expect(svg).toHaveAttribute("data-syringe", "1");
  expect(svg).toHaveAttribute("data-state", "ok");
  expect(container.querySelector(".syr-fill")).toHaveStyle({ transform: "scaleY(0.2)" });
  const moving = Array.from(container.querySelectorAll(".syr-moving"));
  expect(moving).toHaveLength(2);
  for (const group of moving) {
    expect(group).toHaveStyle({ transform: "translateY(84px)" });
  }
  expect(container.querySelector(".syr-drawlabel")).toHaveTextContent("20");
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/App.test.tsx test/SyringeDiagram.test.tsx`
Expected: FAIL. The 4 new App tests fail, e.g. `Unable to find an accessible element with the role "region" and name "Answer"`, and `SyringeDiagram.test.tsx` fails with `Failed to resolve import "@/components/SyringeDiagram"`. The 4 input tests still pass.

- [ ] **Step 3: Append the syringe styles to `src/index.css`**

Add at the end of the file (the SVG class names match `SyringeDiagram`; `.syr:not([data-state=…])` hides the draw line unless the state is `ok` and the overflow line unless it is `overflow`, keeping both mounted so they can slide):

```css
/* The syringe ------------------------------------------------------------ */

@layer components {
  .syr-needle {
    stroke: var(--muted-foreground);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .syr-hub {
    fill: var(--muted-foreground);
  }
  .syr-barrel {
    fill: var(--barrel);
    stroke: var(--foreground);
    stroke-width: 1.5;
  }
  .syr-rod {
    fill: var(--rod);
  }
  .syr-fill {
    fill: var(--solution);
    transform-box: fill-box;
    transform-origin: top;
  }
  .syr-stopper {
    fill: var(--stopper);
  }
  .syr-tick {
    stroke: var(--foreground);
    stroke-width: 1;
  }
  .syr-tick-major {
    stroke-width: 1.5;
  }
  .syr-label {
    fill: var(--foreground);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
  }
  .syr-drawline {
    stroke: var(--draw);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .syr-drawlabel {
    fill: var(--foreground);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    text-anchor: end;
  }
  .syr-overflow {
    stroke: var(--destructive);
    stroke-width: 3;
    stroke-dasharray: 4 3;
  }
  .syr-flange,
  .syr-thumb {
    fill: var(--foreground);
  }
  .syr:not([data-state="ok"]) .syr-draw,
  .syr:not([data-state="overflow"]) .syr-overflow {
    display: none;
  }
  .syr-fill,
  .syr-moving {
    transition: transform 250ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .syr-fill,
    .syr-moving {
      transition: none;
    }
  }
}
```

- [ ] **Step 4: Write `src/components/Notices.tsx`**

```tsx
import { glueUnits } from "@/lib/text";

// Warnings and errors: a caution rule on the left, text in the normal colour.
export function Notices({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2.5 first:mt-0">
      {messages.map((message) => (
        <li key={message} className="border-l-4 border-destructive py-0.5 pl-3">
          {glueUnits(message)}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Write `src/components/AnswerCard.tsx`**

Explicit `{" "}` between the verb, figure and tail keep the text readable to screen readers and to `toHaveTextContent` (block spans don't add spaces to `textContent`).

```tsx
import { Notices } from "@/components/Notices";
import {
  describeWaterMeasure,
  formatConcentration,
  formatDoses,
  formatMl,
  formatUnits,
  formatWaterMl,
  type CalcMessage,
  type DrawResponse,
  type SyringeKey,
  type WaterOptionsResponse,
  type WaterRow,
} from "@/lib/calc";
import { glueUnits, splitFigure } from "@/lib/text";

type AnswerCardProps =
  | { mode: "mix"; response: WaterOptionsResponse; selected: WaterRow | null; syringe: SyringeKey }
  | { mode: "draw"; response: DrawResponse };

const PROMPTS = {
  mix: "Enter your vial and dose to see how much water to add.",
  draw: "Enter your vial, water and dose to see where to draw.",
};

// "Add / 1.5 mL / of bacteriostatic water": the number is the readout, sized to be read at arm's length.
function Figure({ verb, text, tail }: { verb: string; text: string; tail?: string }) {
  const figure = splitFigure(text);
  return (
    <p className="mb-3 leading-none">
      <span className="block font-semibold">{verb}</span>{" "}
      {figure ? (
        <span className="font-mono font-semibold">
          <span className="text-answer tracking-tight">{figure.number}</span>
          <span className="text-xl">{`\u00a0${figure.unit}`}</span>
        </span>
      ) : (
        <span className="text-xl font-semibold">{glueUnits(text)}</span>
      )}
      {tail && (
        <>
          {" "}
          <span className="mt-1 block font-semibold">{tail}</span>
        </>
      )}
    </p>
  );
}

function Detail({ text }: { text: string }) {
  return <p className="mt-1">{glueUnits(text)}</p>;
}

// Before there is an answer: general errors if any, otherwise what to type.
function Empty({ prompt, errors }: { prompt: string; errors: CalcMessage[] }) {
  const general = errors.filter((error) => !error.field).map((error) => error.message);
  if (general.length) return <Notices messages={general} />;
  return <p className="text-muted-foreground">{prompt}</p>;
}

function MixAnswer({
  response,
  selected,
  syringe,
}: {
  response: WaterOptionsResponse;
  selected: WaterRow | null;
  syringe: SyringeKey;
}) {
  if (response.errors.length || !selected) {
    return <Empty prompt={PROMPTS.mix} errors={response.errors} />;
  }
  const notices = response.warnings.map((warning) => warning.message);
  if (selected.note) notices.push(selected.note);
  return (
    <>
      <Figure verb="Add" text={formatWaterMl(selected.waterMl)} tail="of bacteriostatic water" />
      <Detail text={`Measure: ${describeWaterMeasure(selected.waterMl, syringe)}`} />
      <Detail
        text={`Makes ${formatConcentration(selected.concentration)}. Your dose: ${formatUnits(selected.units)}.`}
      />
      <Detail text={`${formatDoses(response.dosesInVial, response.leftoverMg)}.`} />
      <Notices messages={notices} />
    </>
  );
}

function DrawAnswer({ response }: { response: DrawResponse }) {
  const result = response.result;
  if (!result) return <Empty prompt={PROMPTS.draw} errors={response.errors} />;
  const notices = [...response.errors, ...response.warnings].map((message) => message.message);
  return (
    <>
      <Figure verb="Draw to" text={formatUnits(result.units)} />
      <Detail
        text={`${formatMl(result.ml)} at ${formatConcentration(result.concentration)}. ${formatDoses(result.dosesInVial, result.leftoverMg)}.`}
      />
      {result.nearestMarkText && <Detail text={result.nearestMarkText} />}
      <Notices messages={notices} />
    </>
  );
}

export function AnswerCard(props: AnswerCardProps) {
  return (
    <section aria-label="Answer" aria-live="polite" className="border-t border-foreground pt-4">
      {props.mode === "mix" ? (
        <MixAnswer response={props.response} selected={props.selected} syringe={props.syringe} />
      ) : (
        <DrawAnswer response={props.response} />
      )}
    </section>
  );
}
```

- [ ] **Step 6: Write `src/components/SyringeDiagram.tsx`**

The same shapes and coordinates as `renderSyringe` in `legacy/syringe.js`. `key={syringe}` on the `<svg>` means React keeps the element while the dose changes, so the CSS transition slides the fill and plunger, and rebuilds it when the syringe size changes. On phones the caption sits beside the syringe; from 640px up it sits underneath.

```tsx
import {
  BARREL_BOTTOM,
  BARREL_LEFT,
  BARREL_RIGHT,
  BARREL_TOP,
  CENTER_X,
  SCALE_LENGTH,
  SCALE_TOP,
  STOPPER_HEIGHT,
  THUMB_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  describeSyringe,
  scaleMarks,
  syringePosition,
  type SyringeView,
} from "@/lib/syringe";

const INNER_LEFT = BARREL_LEFT + 1.5;
const INNER_WIDTH = BARREL_RIGHT - BARREL_LEFT - 3;
const SCALE_BOTTOM = SCALE_TOP + SCALE_LENGTH;

// The upright syringe. Keyed by size, so it only rebuilds when the syringe changes;
// otherwise the fill and plunger slide to the new dose.
export function SyringeDiagram({ syringe, units, state }: SyringeView) {
  const position = syringePosition({ syringe, units, state });
  const moving = { transform: `translateY(${position.offset}px)` };
  return (
    <figure className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-4 sm:block">
      <svg
        key={syringe}
        className="syr block h-auto max-h-[640px] w-full"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={describeSyringe({ syringe, units, state })}
        data-syringe={syringe}
        data-state={state}
      >
        <line className="syr-needle" x1={CENTER_X} y1={6} x2={CENTER_X} y2={60} />
        <rect
          className="syr-hub"
          x={CENTER_X - 7}
          y={58}
          width={14}
          height={BARREL_TOP - 58}
          rx={2}
        />
        <rect
          className="syr-barrel"
          x={BARREL_LEFT}
          y={BARREL_TOP}
          width={BARREL_RIGHT - BARREL_LEFT}
          height={BARREL_BOTTOM - BARREL_TOP}
          rx={3}
        />
        {/* The rod runs the full length behind the liquid; the opaque fill hides the part above the stopper. */}
        <rect
          className="syr-rod"
          x={CENTER_X - 3}
          y={SCALE_TOP}
          width={6}
          height={THUMB_TOP - SCALE_TOP}
        />
        <rect
          className="syr-fill"
          x={INNER_LEFT}
          y={SCALE_TOP}
          width={INNER_WIDTH}
          height={SCALE_LENGTH}
          style={{ transform: `scaleY(${position.fillScale})` }}
        />
        <g className="syr-moving" style={moving}>
          <rect
            className="syr-stopper"
            x={INNER_LEFT}
            y={SCALE_TOP}
            width={INNER_WIDTH}
            height={STOPPER_HEIGHT}
            rx={2}
          />
        </g>
        {scaleMarks(syringe).map((mark) => (
          <g key={mark.units}>
            <line
              className={mark.major ? "syr-tick syr-tick-major" : "syr-tick"}
              x1={BARREL_RIGHT - (mark.major ? 16 : 8)}
              y1={mark.y}
              x2={BARREL_RIGHT}
              y2={mark.y}
            />
            {mark.major && (
              <text className="syr-label" x={BARREL_RIGHT + 6} y={mark.y} dy="0.35em">
                {mark.units}
              </text>
            )}
          </g>
        ))}
        <line
          className="syr-overflow"
          x1={BARREL_LEFT - 6}
          y1={SCALE_BOTTOM}
          x2={BARREL_RIGHT}
          y2={SCALE_BOTTOM}
        />
        <g className="syr-moving syr-draw" style={moving}>
          <line
            className="syr-drawline"
            x1={BARREL_LEFT - 6}
            y1={SCALE_TOP}
            x2={BARREL_RIGHT}
            y2={SCALE_TOP}
          />
          <text className="syr-drawlabel" x={BARREL_LEFT - 10} y={SCALE_TOP} dy="0.35em">
            {position.label}
          </text>
        </g>
        <rect
          className="syr-flange"
          x={BARREL_LEFT - 14}
          y={BARREL_BOTTOM}
          width={BARREL_RIGHT - BARREL_LEFT + 28}
          height={8}
          rx={2}
        />
        <rect className="syr-thumb" x={CENTER_X - 16} y={THUMB_TOP} width={32} height={8} rx={2} />
      </svg>
      <figcaption className="text-sm text-muted-foreground sm:mt-2">
        Read at the top edge of the rubber stopper.
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx`**

Adds the two-column workspace (fields and answer left, syringe right from 640px), the recommended row as `selected`, and the syringe view.

```tsx
import { useMemo, useState } from "react";
import { AmountField } from "@/components/AmountField";
import { AnswerCard } from "@/components/AnswerCard";
import { ModeTabs, type Mode } from "@/components/ModeTabs";
import { SyringeDiagram } from "@/components/SyringeDiagram";
import { SyringePicker } from "@/components/SyringePicker";
import {
  drawForDose,
  isIncompleteAmount,
  parseAmount,
  waterOptions,
  type AmountField as Field,
  type CalcMessage,
  type SyringeKey,
} from "@/lib/calc";
import type { SyringeView } from "@/lib/syringe";

type AmountText = Record<Field, string>;

// Field errors appear only once something invalid is typed, so an empty form
// stays calm and "0." on the way to "0.5" doesn't flash red.
function visibleError(field: Field, text: string, errors: CalcMessage[]): string | undefined {
  const error = errors.find((e) => e.field === field);
  if (!error || text.trim() === "" || isIncompleteAmount(text)) return undefined;
  return error.message;
}

export function App() {
  const [mode, setMode] = useState<Mode>("mix");
  const [text, setText] = useState<AmountText>({ vialMg: "", waterMl: "", doseMg: "" });
  const [syringe, setSyringe] = useState<SyringeKey>("1");

  const values = useMemo(
    () => ({
      vialMg: parseAmount(text.vialMg),
      waterMl: parseAmount(text.waterMl),
      doseMg: parseAmount(text.doseMg),
      syringe,
    }),
    [text, syringe],
  );
  const mix = useMemo(() => waterOptions(values), [values]);
  const draw = useMemo(() => drawForDose(values), [values]);

  const selected = mix.rows.find((row) => row.recommended) ?? mix.rows[0] ?? null;

  let view: SyringeView = { syringe, units: 0, state: "empty" };
  if (mode === "mix" && selected) {
    view = {
      syringe,
      units: selected.units,
      state: selected.status === "wont-fit" ? "overflow" : "ok",
    };
  } else if (mode === "draw" && draw.result) {
    view = { syringe, units: draw.result.units, state: draw.result.fits ? "ok" : "overflow" };
  }

  const errors = mode === "mix" ? mix.errors : draw.errors;

  function changeText(field: Field, value: string) {
    setText((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-5 pb-10 sm:pt-10">
      <ModeTabs mode={mode} onModeChange={setMode}>
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-10">
          <div className="flex min-w-0 flex-col gap-5">
            <AmountField
              id="vial"
              label="Vial"
              unit="mg"
              value={text.vialMg}
              error={visibleError("vialMg", text.vialMg, errors)}
              onChange={(value) => {
                changeText("vialMg", value);
              }}
            />
            {mode === "draw" && (
              <AmountField
                id="water"
                label="Water added"
                unit="mL"
                value={text.waterMl}
                error={visibleError("waterMl", text.waterMl, errors)}
                onChange={(value) => {
                  changeText("waterMl", value);
                }}
              />
            )}
            <AmountField
              id="dose"
              label="Your dose"
              unit="mg"
              value={text.doseMg}
              error={visibleError("doseMg", text.doseMg, errors)}
              onChange={(value) => {
                changeText("doseMg", value);
              }}
            />
            <SyringePicker value={syringe} onChange={setSyringe} />
            {mode === "mix" ? (
              <AnswerCard mode="mix" response={mix} selected={selected} syringe={syringe} />
            ) : (
              <AnswerCard mode="draw" response={draw} />
            )}
          </div>
          <SyringeDiagram {...view} />
        </div>
      </ModeTabs>
      <footer className="mt-10 max-w-[40em] text-sm text-muted-foreground">
        This does arithmetic only. Check your numbers with your prescriber or pharmacist.
      </footer>
    </main>
  );
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run`
Expected: PASS, `Test Files  5 passed (5)`, `Tests  67 passed (67)`.

- [ ] **Step 9: Look at it**

`npm run dev`, 390px wide, type Vial `10`, dose `2`. Expected: "Add / **1.0** mL / of bacteriostatic water" with the figure in large monospace, three detail lines, then the syringe with its fill to 20, an orange line at 20 and the bold label "20" to its left. Switch to 0.3 mL in Draw with water `2`: dashed caution line at the bottom of the barrel, no orange line, and the won't-fit notice with a caution rule. Stop the server.

- [ ] **Step 10: Check and commit**

```bash
npm run format
npm run check
git add -A
git commit -m "Add the answer card and the syringe diagram

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected from `npm run check`: all green, `Tests  67 passed (67)`.

---

### Task 5: Water options table and worked math

Let the user pick a water amount from the table, and show the working in Draw. This completes the page.

**Files:**
- Create: `src/components/ui/table.tsx`, `src/components/WaterOptionsTable.tsx`, `src/components/WorkedMath.tsx`
- Modify: `src/App.tsx` (replace), `test/App.test.tsx` (edit import, append tests)

**Interfaces:**
- Consumes: `@/lib/calc` (`formatConcentration`, `formatUnits`, `formatWaterMl`, `RowStatus`, `WaterRow`), `@/lib/text` (`glueUnits`), `@/lib/utils` (`cn`).
- Produces:
  - `WaterOptionsTable({ rows: WaterRow[], selectedWaterMl: number | null, onSelect(waterMl: number) })`, where each row holds a native radio named `water`
  - `WorkedMath({ lines: string[] })`
  - the final `App` with the `selectedWaterMl` state and its reset rules

- [ ] **Step 1: Update the test import**

In `test/App.test.tsx`, change the first import from `@testing-library/react` to also bring in `within`:

```tsx
import { render, screen, within } from "@testing-library/react";
```

- [ ] **Step 2: Append the failing table and worked-math tests**

Add after the last test in the file:

```tsx
// --- water options and worked math -----------------------------------

test("mix: the recommended row starts selected", async () => {
  const { waterRadio, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  expect(waterRadio("1.0 mL")).toBeChecked();
  expect(within(row("1.0 mL")).getByText("Recommended")).toBeInTheDocument();
});

test("mix: tapping anywhere on a row selects it", async () => {
  const { user, answer, waterRadio, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(within(row("2.0 mL")).getByText("40 units"));
  expect(waterRadio("2.0 mL")).toBeChecked();
  expect(waterRadio("2.0 mL")).toHaveFocus();
  expect(answer()).toHaveTextContent("Add 2.0 mL of bacteriostatic water");
  expect(answer()).toHaveTextContent("Your dose: 40 units.");
});

test("mix: arrow keys move the chosen row and the answer follows", async () => {
  const { user, answer, waterRadio, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  waterRadio("1.0 mL").focus();
  await user.keyboard("{ArrowDown}");
  expect(waterRadio("1.5 mL")).toBeChecked();
  expect(answer()).toHaveTextContent("Add 1.5 mL of bacteriostatic water");
});

test("mix: editing the dose or changing syringe goes back to the recommendation", async () => {
  const { user, answer, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(row("2.0 mL"));
  expect(answer()).toHaveTextContent("Add 2.0 mL");

  await user.clear(screen.getByLabelText("Your dose"));
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Add 1.0 mL");

  await user.click(row("2.0 mL"));
  expect(answer()).toHaveTextContent("Add 2.0 mL");
  await user.click(screen.getByRole("radio", { name: "0.5 mL" }));
  expect(screen.getByRole("radio", { name: "0.5 mL" })).toHaveAttribute("aria-checked", "true");
  expect(answer()).toHaveTextContent("Add 1.0 mL");
});

test("switching tabs keeps the chosen row", async () => {
  const { user, answer, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(row("2.0 mL"));
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(answer()).toHaveTextContent("Add 2.0 mL");
});

test("mix: a row that won't fit explains why and shows the overflow", async () => {
  const { user, answer, syringe, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(screen.getByRole("radio", { name: "0.3 mL" }));
  await user.click(row("2.0 mL"));
  expect(within(row("2.0 mL")).getByText("Won't fit")).toBeInTheDocument();
  expect(answer()).toHaveTextContent(
    "At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds.",
  );
  expect(syringe()).toHaveAttribute("data-state", "overflow");
});

test("draw: the worked math appears only once there is an answer", async () => {
  const { user, type } = setup();
  const heading = () => screen.queryByRole("heading", { name: "How this was worked out" });
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "2");
  expect(heading()).toBeInTheDocument();
  expect(screen.getByText("0.40 mL × 100 = 40 units")).toBeInTheDocument();
  await type("Your dose", "0");
  expect(heading()).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/App.test.tsx`
Expected: FAIL, the 7 new tests, e.g. `Unable to find an accessible element with the role "radio" and name "1.0 mL"`; the other 8 App tests and the `SyringeDiagram` test pass.

- [ ] **Step 4: Add the shadcn table primitive**

`src/components/ui/table.tsx` (generated by `shadcn@4.21.0 add table`, Prettier-formatted):

```tsx
import * as React from "react";
import { cn } from "cn";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
```

- [ ] **Step 5: Write `src/components/WaterOptionsTable.tsx`**

The radio sits inside the Water cell's label, so its accessible name is the water amount and arrow keys move the choice. Clicking anywhere else on the row calls `onSelect` too and moves focus to that row's radio, as `app.js` did, so arrow keys work straight after a tap (selecting the same row twice is harmless). The selected row gets `bg-muted` from shadcn's `data-[state=selected]` and a 3px `draw` bar on its left edge. The Strength column uses the `narrow:` variant from `index.css`.

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatConcentration,
  formatUnits,
  formatWaterMl,
  type RowStatus,
  type WaterRow,
} from "@/lib/calc";
import { glueUnits } from "@/lib/text";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Partial<Record<RowStatus, string>> = {
  "wont-fit": "Won't fit",
  "hard-to-measure": "Hard to measure",
  "between-marks": "Between marks",
};

interface WaterOptionsTableProps {
  rows: WaterRow[];
  selectedWaterMl: number | null;
  onSelect: (waterMl: number) => void;
}

// Each row is a radio, so arrow keys move the choice; tapping anywhere on a row picks it too.
export function WaterOptionsTable({ rows, selectedWaterMl, onSelect }: WaterOptionsTableProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Water amounts" className="mt-10">
      <Table className="text-base">
        <TableCaption className="sr-only">Water amounts to choose from</TableCaption>
        <TableHeader>
          <TableRow className="border-foreground hover:bg-transparent">
            <TableHead
              scope="col"
              className="h-auto pb-2 pl-3 text-sm font-semibold text-muted-foreground"
            >
              Water
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground narrow:hidden"
            >
              Strength
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground"
            >
              Dose
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground"
            >
              1 mg =
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const selected = row.waterMl === selectedWaterMl;
            const status = STATUS_TEXT[row.status];
            return (
              <TableRow
                key={row.waterMl}
                data-state={selected ? "selected" : undefined}
                onClick={(event) => {
                  onSelect(row.waterMl);
                  // Like tapping the label: focus the radio so arrow keys work next.
                  event.currentTarget.querySelector<HTMLInputElement>("input[name=water]")?.focus();
                }}
                className={cn(
                  "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-ring",
                  "data-[state=selected]:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-draw)]",
                  row.status !== "ok" && "[&>td:not(:first-child)]:text-muted-foreground",
                )}
              >
                <TableCell className="py-2.5 pl-3 align-top">
                  <label className="block cursor-pointer font-mono font-semibold">
                    <input
                      type="radio"
                      name="water"
                      value={row.waterMl}
                      checked={selected}
                      onChange={() => {
                        onSelect(row.waterMl);
                      }}
                      className="sr-only"
                    />
                    {glueUnits(formatWaterMl(row.waterMl))}
                  </label>
                  {row.recommended ? (
                    <span className="block text-sm font-semibold">
                      <span aria-hidden="true" className="text-draw">
                        ★
                      </span>{" "}
                      Recommended
                    </span>
                  ) : (
                    status && <span className="block text-sm text-muted-foreground">{status}</span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono narrow:hidden">
                  {glueUnits(formatConcentration(row.concentration))}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono">
                  {glueUnits(formatUnits(row.units))}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono">
                  {glueUnits(formatUnits(row.unitsPerMg))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
```

- [ ] **Step 6: Write `src/components/WorkedMath.tsx`**

```tsx
import { glueUnits } from "@/lib/text";

export function WorkedMath({ lines }: { lines: string[] }) {
  return (
    <section aria-labelledby="math-heading" className="mt-10 border-t pt-4">
      <h2 id="math-heading" className="mb-2 font-semibold">
        How this was worked out
      </h2>
      <ol className="grid gap-1 font-mono text-sm sm:text-base">
        {lines.map((line) => (
          <li key={line}>{glueUnits(line)}</li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx` with the final version**

Adds `selectedWaterMl`: typing in any amount field or changing syringe resets it to `null` (use the recommendation); switching mode leaves it alone.

```tsx
import { useMemo, useState } from "react";
import { AmountField } from "@/components/AmountField";
import { AnswerCard } from "@/components/AnswerCard";
import { ModeTabs, type Mode } from "@/components/ModeTabs";
import { SyringeDiagram } from "@/components/SyringeDiagram";
import { SyringePicker } from "@/components/SyringePicker";
import { WaterOptionsTable } from "@/components/WaterOptionsTable";
import { WorkedMath } from "@/components/WorkedMath";
import {
  drawForDose,
  isIncompleteAmount,
  parseAmount,
  waterOptions,
  type AmountField as Field,
  type CalcMessage,
  type SyringeKey,
} from "@/lib/calc";
import type { SyringeView } from "@/lib/syringe";

type AmountText = Record<Field, string>;

// Field errors appear only once something invalid is typed, so an empty form
// stays calm and "0." on the way to "0.5" doesn't flash red.
function visibleError(field: Field, text: string, errors: CalcMessage[]): string | undefined {
  const error = errors.find((e) => e.field === field);
  if (!error || text.trim() === "" || isIncompleteAmount(text)) return undefined;
  return error.message;
}

export function App() {
  const [mode, setMode] = useState<Mode>("mix");
  const [text, setText] = useState<AmountText>({ vialMg: "", waterMl: "", doseMg: "" });
  const [syringe, setSyringe] = useState<SyringeKey>("1");
  // The water amount tapped in the table. null means "use the recommendation".
  const [selectedWaterMl, setSelectedWaterMl] = useState<number | null>(null);

  const values = useMemo(
    () => ({
      vialMg: parseAmount(text.vialMg),
      waterMl: parseAmount(text.waterMl),
      doseMg: parseAmount(text.doseMg),
      syringe,
    }),
    [text, syringe],
  );
  const mix = useMemo(() => waterOptions(values), [values]);
  const draw = useMemo(() => drawForDose(values), [values]);

  const selected =
    mix.rows.find((row) => row.waterMl === selectedWaterMl) ??
    mix.rows.find((row) => row.recommended) ??
    mix.rows[0] ??
    null;

  let view: SyringeView = { syringe, units: 0, state: "empty" };
  if (mode === "mix" && selected) {
    view = {
      syringe,
      units: selected.units,
      state: selected.status === "wont-fit" ? "overflow" : "ok",
    };
  } else if (mode === "draw" && draw.result) {
    view = { syringe, units: draw.result.units, state: draw.result.fits ? "ok" : "overflow" };
  }

  const errors = mode === "mix" ? mix.errors : draw.errors;

  function changeText(field: Field, value: string) {
    setText((previous) => ({ ...previous, [field]: value }));
    setSelectedWaterMl(null);
  }

  function changeSyringe(next: SyringeKey) {
    setSyringe(next);
    setSelectedWaterMl(null);
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-5 pb-10 sm:pt-10">
      <ModeTabs mode={mode} onModeChange={setMode}>
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-10">
          <div className="flex min-w-0 flex-col gap-5">
            <AmountField
              id="vial"
              label="Vial"
              unit="mg"
              value={text.vialMg}
              error={visibleError("vialMg", text.vialMg, errors)}
              onChange={(value) => {
                changeText("vialMg", value);
              }}
            />
            {mode === "draw" && (
              <AmountField
                id="water"
                label="Water added"
                unit="mL"
                value={text.waterMl}
                error={visibleError("waterMl", text.waterMl, errors)}
                onChange={(value) => {
                  changeText("waterMl", value);
                }}
              />
            )}
            <AmountField
              id="dose"
              label="Your dose"
              unit="mg"
              value={text.doseMg}
              error={visibleError("doseMg", text.doseMg, errors)}
              onChange={(value) => {
                changeText("doseMg", value);
              }}
            />
            <SyringePicker value={syringe} onChange={changeSyringe} />
            {mode === "mix" ? (
              <AnswerCard mode="mix" response={mix} selected={selected} syringe={syringe} />
            ) : (
              <AnswerCard mode="draw" response={draw} />
            )}
          </div>
          <SyringeDiagram {...view} />
        </div>
        {mode === "mix" ? (
          <WaterOptionsTable
            rows={mix.rows}
            selectedWaterMl={selected?.waterMl ?? null}
            onSelect={setSelectedWaterMl}
          />
        ) : (
          draw.result && <WorkedMath lines={draw.result.workedMath} />
        )}
      </ModeTabs>
      <footer className="mt-10 max-w-[40em] text-sm text-muted-foreground">
        This does arithmetic only. Check your numbers with your prescriber or pharmacist.
      </footer>
    </main>
  );
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run`
Expected: PASS, `Test Files  5 passed (5)`, `Tests  74 passed (74)`.

- [ ] **Step 9: Check and commit**

```bash
npm run format
npm run check
git add -A
git commit -m "Add the water options table and worked math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected from `npm run check`: all green, `Tests  74 passed (74)`.

---

### Task 6: Visual pass, parity check and cleanup

Review the finished page against the spec in a real browser, compare it with the old app, fix what's off, then delete `legacy/`.

**Files:**
- Modify: any of `src/index.css`, `src/components/*.tsx` as the review requires
- Delete: `legacy/`

**Interfaces:**
- Consumes: the finished app.
- Produces: screenshots for the user; a branch with no legacy code.

- [ ] **Step 1: Load the design skill and start both apps**

Load `frontend-design:frontend-design`. Then run `npm run dev` in the background. The new app is at http://localhost:5173/ and the old one at http://localhost:5173/legacy/index.html (Vite serves it as a static page; opening `legacy/index.html` straight from disk also works).

- [ ] **Step 2: Parity check against the old app**

In both apps, enter each case below and confirm the answer text, table rows/statuses, notices and syringe position match exactly (only the styling may differ):

| Tab | Vial | Water | Dose | Syringe | Expect |
|---|---|---|---|---|---|
| Mix | 10 | | 2 | 1 mL | Add 1.0 mL, ★ Recommended on 1.0 mL, syringe at 20 |
| Mix | 12 | | 2.5 | 1 mL | Extra 2.4 mL row, recommended |
| Mix | 30 | | 1 | 1 mL | No star; "No amount from 1 to 3 mL makes a 1 mg dose easy to measure with a 1 mL syringe. A 0.3 mL syringe works with 3.0 mL of water." |
| Mix | 10 | | 2 | 0.3 mL, tap 2.0 mL row | Won't fit note, overflow syringe |
| Draw | 10 | 2 | 1.95 | 1 mL | Draw to 39 units, "Nearest mark: 40 units = 2 mg (3% over)" |
| Draw | 10 | 1 | 1.8 | 1 mL | Hard-to-measure warning (11%) |
| Draw | 10 | 2 | 12 | 1 mL | "Your dose is more than the whole vial (10 mg)." |
| Draw | 10 | 2 | 0.004 | 1 mL | "less than 0.1 units", syringe label `<0.1` |
| Mix | 1,000 | | 2 | 1 mL | The vial field shows "Enter the vial amount in mg." and there's no answer: `1,000` is rejected as ambiguous |

Any difference in numbers or wording is a bug in the port. Fix it with a failing test first.

- [ ] **Step 3: Screenshots**

With the Playwright browser tools (save under `.playwright-mcp/`, which is gitignored), take full-page screenshots of:
- Mix (10 mg, 2 mg, 1 mL) at 390×844 and at 1280×900, in light and in dark (`browser_emulate_media` `colorScheme`)
- Draw (10 mg, 2 mL, 2 mg, 0.3 mL: the won't-fit state) at 390×844 and 1280×900, light and dark

Review each against the spec's Visual design section: the syringe is the one bold element; orange appears only on the draw line, the ★ and the selected-row bar; numbers are in IBM Plex Mono; no text wraps between a number and its unit; visible focus rings (Tab through the page); nothing overflows horizontally at 390px.

- [ ] **Step 4: Check the CSS-only rules (Review Focus 5)**

At 390px wide, confirm the table has no Strength column. At 1280px, confirm it does. Then emulate `reducedMotion: "reduce"` and evaluate in the page:

```js
getComputedStyle(document.querySelector(".syr-fill")).transitionDuration
```

Expected: `"0s"` (and `"0.25s"` without the emulation).

- [ ] **Step 5: Fix what the review found**

Make only the changes the review calls for, keeping the spec's constraints. After each change, run `npx vitest run` (expect 74 passing) and re-take the affected screenshot. If a colour token changes, re-check its contrast (text ≥ 4.5:1, `draw` ≥ 3:1 against the background).

- [ ] **Step 6: Delete the old app and run the final check**

Stop the dev server, then run the old tests one last time and delete the old app:

```bash
node --test legacy/test/*.test.js
git rm -r legacy
npm run check
```

Expected: the old tests print `ℹ pass 54` one last time, then `npm run check` is all green, with `Tests  74 passed (74)`, `✓ built in …`, and `dist/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Finish the visual pass and remove the legacy app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report**

Show the user the screenshots from Step 3 (after fixes) and the final `npm run check` output. Mention that `npm run build` produces `dist/`, which Vercel's Vite preset serves with no extra configuration when they're ready to deploy.
