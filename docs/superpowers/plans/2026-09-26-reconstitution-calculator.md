# Retatrutide Reconstitution Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page, no-build web app that tells you how much bacteriostatic water to add to a dry retatrutide vial, and how many syringe units to draw for a dose.

**Architecture:** Three plain scripts in load order. `calc.js` holds all the math and number formatting as pure functions. `syringe.js` turns a syringe size and dose into SVG markup. `app.js` reads the form, calls both, and updates the page. `calc.js` and `syringe.js` export through `module.exports` in Node and `window.Calc` / `window.Syringe` in the browser, so the same files are tested with `node --test` and run from a double-clicked `index.html`.

**Tech Stack:** HTML, CSS, vanilla JavaScript (ES2020, no modules), Node 24's built-in test runner, Atkinson Hyperlegible Next from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-26-reconstitution-calculator-design.md`

## Global Constraints

- No build step, no npm packages, no `package.json`. Tests run with `node --test` from the project root.
- Plain `<script>` tags, not ES modules: browsers block module scripts on pages opened from `file://`. Load order is `calc.js`, `syringe.js`, `app.js`.
- Units are mg, mL and U-100 syringe units only: 100 units = 1 mL.
- Syringes: 0.3 mL (30 units, mark every 1 unit, labelled every 5), 0.5 mL (50 units, every 1, labelled every 5), 1 mL (100 units, every 2, labelled every 10).
- Floating-point tolerance `EPS = 1e-6`. A value within it of a mark is on the mark.
- Measurable means at least 10 marks' worth: 20 units on the 1 mL syringe, 10 units on the others.
- Water candidates are 1.0 to 3.0 mL in 0.1 mL steps, built as `tenths / 10`. Table rows are always 1.0, 1.5, 2.0, 2.5 and 3.0 mL, plus the recommended amount if it isn't one of those.
- "Easy math" means units per mg of 5, 10, 20, 25, 50 or 100.
- Copy: sentence case, no all-caps labels, every number shows its unit, decimals keep a leading zero.
- Colour tokens exactly as in the spec. `--cap-orange` is used only for the syringe draw line.
- One typeface: `"Atkinson Hyperlegible Next", system-ui, sans-serif`. Body 17px. Inputs inherit font size, never below 16px.
- Nothing is stored: no `localStorage`, cookies or network calls apart from the font.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A dose so small it rounds to 0 must never read "0 units".** It shows "less than 0.1 units". Pinned by the `formatUnits never shows a real dose as 0 units` test in Task 1 and `waterOptions survives extreme inputs` in Task 3.
2. **An untouched empty form shows no red field errors.** An error appears only after something invalid is typed, and clears when the field is fixed or emptied. Pinned by browser check 5-c in Task 5.
3. **Changing vial, dose or syringe after tapping a row resets the selection to the new recommendation**, and the answer, syringe and highlighted row always agree. Pinned by browser check 5-d in Task 5.
4. **iOS Safari zooms into inputs smaller than 16px.** The amount inputs must compute to 27px. Pinned by browser check 5-f in Task 5.
5. **Extreme inputs must not break the phone layout.** For example, a 100000 mg vial with a 0.001 mg dose, or a draw of 300 units, must not scroll sideways at 375px. Pinned by browser check 6-b in Task 6.

---

### Task 1: Math foundations — syringes, parsing, formatting

**Files:**
- Create: `calc.js`
- Test: `test/calc.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces, on `Calc` (`window.Calc` in the browser, `require("./calc.js")` in Node):
  - `SYRINGES`: `{ "0.3" | "0.5" | "1": { key, label, capacityMl, capacityUnits, markSpacing, labelEvery } }`
  - `SYRINGE_ORDER`: `["0.3", "0.5", "1"]`
  - `parseAmount(text: string) → number | null`. `null` for empty, zero, negative or non-numeric text. Accepts `,` as the decimal point.
  - `formatMg(mg) → "2 mg"`, `formatConcentration(mgPerMl) → "6.67 mg/mL"`, `formatMl(ml) → "0.40 mL"`, `formatWaterMl(ml) → "1.0 mL"`, `formatUnits(units) → "40 units"`, `formatPercentOff(fraction) → "3% over"`, `formatDoses(count, leftoverMg) → "4 doses in the vial, plus 2 mg left over"`. All return strings.
  - Internal helpers that later tasks use inside `calc.js`: `EPS`, `MISSING`, `EASY_UNITS_PER_MG`, `TABLE_WATER_ML`, `MIN_WATER_TENTHS`, `MAX_WATER_TENTHS`, `snap(value)`, `roundTo(value, places)`, `decimals(value, min, max)`, `syringePhrase(keys) → "a 0.3 mL or 0.5 mL syringe"`, `capitalize(text)`.

- [ ] **Step 1: Write the failing tests**

Create `test/calc.test.js`. The three helpers at the top are used by Tasks 2 and 3; they are plain arrow functions, so defining them now is harmless.

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Calc = require("../calc.js");

const codes = (list) => list.map((item) => item.code);
const draw = (vialMg, waterMl, doseMg, syringe = "1") => Calc.drawForDose({ vialMg, waterMl, doseMg, syringe });
const options = (vialMg, doseMg, syringe = "1") => Calc.waterOptions({ vialMg, doseMg, syringe });

// --- syringes, parsing, formatting -------------------------------

test("SYRINGES describes the three U-100 syringes", () => {
  assert.deepEqual(Calc.SYRINGE_ORDER, ["0.3", "0.5", "1"]);
  assert.deepEqual(
    Calc.SYRINGE_ORDER.map((key) => [Calc.SYRINGES[key].capacityUnits, Calc.SYRINGES[key].markSpacing, Calc.SYRINGES[key].labelEvery]),
    [[30, 1, 5], [50, 1, 5], [100, 2, 10]],
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
  for (const text of ["", "   ", "0", "0.0", "-1", "abc", "1e3", "1.2.3", "1,2,3", ".", "5 mg", "Infinity"]) {
    assert.equal(Calc.parseAmount(text), null, JSON.stringify(text));
  }
  assert.equal(Calc.parseAmount(undefined), null);
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL with `Cannot find module '../calc.js'`.

- [ ] **Step 3: Write `calc.js`**

```js
// Reconstitution math and number formatting for the retatrutide calculator.
// Pure functions only, with no DOM access, so every number can be tested in Node.
(function () {
  "use strict";

  // Values this close to a mark or a limit count as on it (absorbs float noise).
  const EPS = 1e-6;
  const EASY_UNITS_PER_MG = [5, 10, 20, 25, 50, 100];
  const TABLE_WATER_ML = [1, 1.5, 2, 2.5, 3];
  // Candidate water amounts are built from tenths so 0.1 steps never drift.
  const MIN_WATER_TENTHS = 10;
  const MAX_WATER_TENTHS = 30;

  const SYRINGES = {
    "0.3": { key: "0.3", label: "0.3 mL", capacityMl: 0.3, capacityUnits: 30, markSpacing: 1, labelEvery: 5 },
    "0.5": { key: "0.5", label: "0.5 mL", capacityMl: 0.5, capacityUnits: 50, markSpacing: 1, labelEvery: 5 },
    "1": { key: "1", label: "1 mL", capacityMl: 1, capacityUnits: 100, markSpacing: 2, labelEvery: 10 },
  };
  const SYRINGE_ORDER = ["0.3", "0.5", "1"];

  const MISSING = {
    vialMg: { code: "missing-vial", field: "vialMg", message: "Enter the vial amount in mg." },
    waterMl: { code: "missing-water", field: "waterMl", message: "Enter the water added in mL." },
    doseMg: { code: "missing-dose", field: "doseMg", message: "Enter your dose in mg." },
  };

  // --- Numbers -------------------------------------------------------------

  // Strip binary float noise from computed values: 0.30000000000000004 -> 0.3.
  function snap(value) {
    return Math.round(value * 1e9) / 1e9;
  }

  // The tiny nudge makes halves like 1.005 round up despite binary representation.
  function roundTo(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor * (1 + 1e-12)) / factor;
  }

  // Shows between `min` and `max` decimal places, trimming trailing zeros.
  function decimals(value, min, max) {
    const text = roundTo(value, max).toFixed(max).replace(/\.?0+$/, "");
    if (min === 0) return text;
    const [whole, fraction = ""] = text.split(".");
    return `${whole}.${fraction.padEnd(min, "0")}`;
  }

  function parseAmount(text) {
    if (typeof text !== "string") return null;
    const cleaned = text.trim().replace(",", ".");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
    const value = Number(cleaned);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  // --- Formatting ----------------------------------------------------------

  function formatMg(mg) {
    return `${decimals(mg, 0, 3)} mg`;
  }

  function formatConcentration(mgPerMl) {
    return `${decimals(mgPerMl, 0, 2)} mg/mL`;
  }

  function formatMl(ml) {
    return `${decimals(ml, 2, 3)} mL`;
  }

  function formatWaterMl(ml) {
    return `${decimals(ml, 1, 2)} mL`;
  }

  function formatUnits(units) {
    if (units > 0 && roundTo(units, 1) === 0) return "less than 0.1 units";
    const text = decimals(units, 0, 1);
    return `${text} ${text === "1" ? "unit" : "units"}`;
  }

  function formatPercentOff(fraction) {
    const direction = fraction < 0 ? "under" : "over";
    const percent = Math.round(Math.abs(fraction) * 100);
    return percent < 1 ? `less than 1% ${direction}` : `${percent}% ${direction}`;
  }

  function formatDoses(count, leftoverMg) {
    const doses = `${count} ${count === 1 ? "dose" : "doses"} in the vial`;
    return leftoverMg > 0 ? `${doses}, plus ${formatMg(leftoverMg)} left over` : doses;
  }

  function syringePhrase(keys) {
    return `a ${keys.map((key) => SYRINGES[key].label).join(" or ")} syringe`;
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  const api = {
    SYRINGES,
    SYRINGE_ORDER,
    parseAmount,
    formatMg,
    formatConcentration,
    formatMl,
    formatWaterMl,
    formatUnits,
    formatPercentOff,
    formatDoses,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.Calc = api;
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `tests 11`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add calc.js test/calc.test.js
git commit -m "Add syringe table, amount parsing and number formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Draw a dose — `drawForDose`

**Files:**
- Modify: `calc.js`. Insert a block directly above `  const api = {`, and add one export.
- Test: `test/calc.test.js` (append)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `Calc.drawForDose({ vialMg, waterMl, doseMg, syringe }) → { result, errors, warnings }`.
  - `errors` and `warnings` are arrays of `{ code, message }`. Missing-input errors also carry `field`: `"vialMg" | "waterMl" | "doseMg"`.
  - Error codes: `missing-vial`, `missing-water`, `missing-dose`, `dose-exceeds-vial`, `wont-fit`. Warning code: `hard-to-measure`.
  - `result` is `null` when inputs are missing or the dose exceeds the vial. Otherwise it is `{ concentration, ml, units, unitsPerMg, onMark, fits, measurable, nearestMark, doseAtMarkMg, nearestMarkOff, nearestMarkText (string | null), dosesInVial, leftoverMg, workedMath: string[3] }`.
  - For a `wont-fit` dose, `result` is still filled in and `result.fits` is `false`.
- Also adds internal helpers used by Task 3: `assess(units, syringe) → { nearestMark, onMark, fits, measurable }`, `unitsFor(vialMg, doseMg, waterMl)`, `dosesInVial(vialMg, doseMg) → { count, leftoverMg }`, `checkInputs(values, requiredFields)`, `oneMarkPercent(units, syringe)`.

- [ ] **Step 1: Write the failing tests**

Append to `test/calc.test.js`:

```js
// --- drawForDose --------------------------------------------------

test("drawForDose: 10 mg vial, 2 mL water, 2 mg dose", () => {
  const { result, errors, warnings } = draw(10, 2, 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
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
  assert.equal(result.units, 30);
  assert.equal(result.ml, 0.3);
  assert.equal(result.onMark, true);
});

test("drawForDose: a dose halfway between 2-unit marks rounds up", () => {
  const { result, warnings } = draw(10, 2, 1.95);
  assert.equal(result.units, 39);
  assert.equal(result.onMark, false);
  assert.equal(result.nearestMark, 40);
  assert.equal(result.doseAtMarkMg, 2);
  assert.equal(result.nearestMarkText, "Nearest mark: 40 units = 2 mg (3% over)");
  assert.deepEqual(warnings, []);
});

test("drawForDose: 1-unit marks on the smaller syringes", () => {
  const { result } = draw(10, 2, 2.03, "0.5");
  assert.equal(result.units, 40.6);
  assert.equal(result.nearestMark, 41);
  assert.equal(result.nearestMarkText, "Nearest mark: 41 units = 2.05 mg (1% over)");
});

test("drawForDose: leftover after the last full dose", () => {
  const { result } = draw(12, 2, 2.5);
  assert.equal(result.dosesInVial, 4);
  assert.equal(result.leftoverMg, 2);
});

test("drawForDose reports missing inputs by field", () => {
  const { result, errors } = Calc.drawForDose({ vialMg: null, waterMl: 2, doseMg: null, syringe: "1" });
  assert.equal(result, null);
  assert.deepEqual(errors.map((e) => [e.code, e.field]), [["missing-vial", "vialMg"], ["missing-dose", "doseMg"]]);
  assert.equal(errors[0].message, "Enter the vial amount in mg.");
  const water = Calc.drawForDose({ vialMg: 10, waterMl: null, doseMg: 2, syringe: "1" });
  assert.equal(water.errors[0].message, "Enter the water added in mL.");
});

test("drawForDose rejects a dose bigger than the vial", () => {
  const { result, errors } = draw(10, 2, 12);
  assert.equal(result, null);
  assert.deepEqual(codes(errors), ["dose-exceeds-vial"]);
  assert.equal(errors[0].message, "Your dose is more than the whole vial (10 mg).");
});

test("drawForDose allows a dose equal to the whole vial", () => {
  const { result, errors } = draw(10, 1, 10);
  assert.deepEqual(errors, []);
  assert.equal(result.units, 100);
  assert.equal(result.fits, true);
  assert.equal(result.dosesInVial, 1);
});

test("drawForDose: dose that won't fit the chosen syringe", () => {
  const { result, errors, warnings } = draw(10, 2, 2, "0.3");
  assert.equal(result.units, 40);
  assert.equal(result.fits, false);
  assert.equal(result.nearestMarkText, null);
  assert.deepEqual(codes(errors), ["wont-fit"]);
  assert.equal(errors[0].message, "40 units won't fit in a 0.3 mL (30-unit) syringe. Use a 0.5 mL or 1 mL syringe, or split it into 2 draws.");
  assert.deepEqual(warnings, []);
});

test("drawForDose: dose that won't fit any syringe", () => {
  const { errors } = draw(10, 3, 5);
  assert.equal(errors[0].message, "150 units won't fit in a 1 mL (100-unit) syringe. Split it into 2 draws.");
});

test("drawForDose: a dose exactly at capacity fits", () => {
  const { result, errors } = draw(10, 1.5, 2, "0.3");
  assert.equal(result.units, 30);
  assert.deepEqual(errors, []);
});

test("drawForDose: 1 mL syringe needs at least 20 units to be measurable", () => {
  const below = draw(10, 1, 1.8);
  assert.equal(below.result.units, 18);
  assert.deepEqual(codes(below.warnings), ["hard-to-measure"]);
  assert.equal(
    below.warnings[0].message,
    "Each mark on this syringe is 2 units, so misreading by one mark changes this dose by 11%. A 0.3 mL or 0.5 mL syringe reads more finely.",
  );
  assert.deepEqual(draw(10, 1, 2).warnings, []);
});

test("drawForDose: 0.3 and 0.5 mL syringes need at least 10 units", () => {
  const below = draw(10, 1, 0.9, "0.5");
  assert.equal(below.result.units, 9);
  assert.equal(
    below.warnings[0].message,
    "Each mark on this syringe is 1 unit, so misreading by one mark changes this dose by 11%. Mixing your next vial with more water makes each dose bigger and easier to measure.",
  );
  assert.deepEqual(draw(10, 1, 1, "0.3").warnings, []);
});

test("drawForDose: tiny doses rounding to mark 0 get no nearest-mark line", () => {
  const { result, warnings } = draw(100, 1, 0.005);
  assert.equal(result.nearestMark, 0);
  assert.equal(result.nearestMarkText, null);
  assert.deepEqual(codes(warnings), ["hard-to-measure"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL with `TypeError: Calc.drawForDose is not a function`. The 11 Task 1 tests still pass.

- [ ] **Step 3: Implement `drawForDose`**

In `calc.js`, insert this block directly above the line `  const api = {`:

```js
  // --- Marks and checks ----------------------------------------------------

  function assess(units, syringe) {
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

  function unitsFor(vialMg, doseMg, waterMl) {
    return snap((100 * doseMg * waterMl) / vialMg);
  }

  function dosesInVial(vialMg, doseMg) {
    const count = Math.floor(vialMg / doseMg + EPS);
    const leftover = snap(vialMg - count * doseMg);
    return { count, leftoverMg: leftover > EPS ? leftover : 0 };
  }

  function checkInputs(values, required) {
    const errors = required.filter((field) => !(values[field] > 0)).map((field) => ({ ...MISSING[field] }));
    if (errors.length === 0 && values.doseMg > values.vialMg + EPS) {
      errors.push({
        code: "dose-exceeds-vial",
        message: `Your dose is more than the whole vial (${formatMg(values.vialMg)}).`,
      });
    }
    return errors;
  }

  function oneMarkPercent(units, syringe) {
    return Math.round((SYRINGES[syringe].markSpacing / units) * 100);
  }

  // --- Draw a dose ---------------------------------------------------------

  function wontFitMessage(units, syringe) {
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

  function hardToMeasureMessage(units, syringe) {
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

  function drawForDose({ vialMg, waterMl, doseMg, syringe }) {
    const errors = checkInputs({ vialMg, waterMl, doseMg }, ["vialMg", "waterMl", "doseMg"]);
    if (errors.length) return { result: null, errors, warnings: [] };

    const concentration = snap(vialMg / waterMl);
    const ml = snap((doseMg * waterMl) / vialMg);
    const units = unitsFor(vialMg, doseMg, waterMl);
    const check = assess(units, syringe);
    const doseAtMarkMg = snap((check.nearestMark * vialMg) / (100 * waterMl));
    const nearestMarkOff = (doseAtMarkMg - doseMg) / doseMg;
    const doses = dosesInVial(vialMg, doseMg);
    const showNearest = check.fits && !check.onMark && check.nearestMark > 0;

    const warnings = [];
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
```

Then add `drawForDose,` as the last entry of the `api` object, after `formatDoses,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `tests 25`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add calc.js test/calc.test.js
git commit -m "Add dose drawing math with fit and measurability checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mix a vial — water options, recommendation, measuring water

**Files:**
- Modify: `calc.js`. Insert a block directly above `  const api = {`, and add three exports.
- Test: `test/calc.test.js` (append)

**Interfaces:**
- Consumes: Task 1 and Task 2 helpers: `assess`, `unitsFor`, `dosesInVial`, `checkInputs`, `oneMarkPercent`, `snap`, `syringePhrase`, `capitalize`, the formatters, and the constants.
- Produces:
  - `Calc.waterOptions({ vialMg, doseMg, syringe }) → { rows, recommendedMl, alternative, dosesInVial, leftoverMg, errors, warnings }`.
    - `rows` is sorted by water. Each row is `{ waterMl, concentration, units, unitsPerMg, status, easyMath, note, recommended }`.
    - `status` is one of `"ok" | "wont-fit" | "hard-to-measure" | "between-marks"`. `note` is a string, or `null` when the status is ok.
    - `recommendedMl` is a number or `null`. `alternative` is `{ syringe, waterMl }` or `null`.
    - Warning code: `no-recommendation`. Errors are as in Task 2, without water.
  - `Calc.measureWater(waterMl, syringe) → { fullSyringes, remainderUnits }`.
  - `Calc.describeWaterMeasure(waterMl, syringe) → "2 full syringes + 40 units"`.

- [ ] **Step 1: Write the failing tests**

Append to `test/calc.test.js`:

```js
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
  assert.deepEqual(res.rows.map((r) => r.waterMl), [1, 1.5, 2, 2.5, 3]);
  assert.deepEqual(res.rows.map((r) => r.units), [20, 30, 40, 50, 60]);
  assert.deepEqual(res.rows.map((r) => r.recommended), [true, false, false, false, false]);
  const first = res.rows[0];
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
  assert.deepEqual(res.rows.map((r) => r.waterMl), [1, 1.5, 2, 2.4, 2.5, 3]);
  const recommended = res.rows.find((r) => r.recommended);
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
  assert.equal(recommended.units, 94);
  assert.equal(recommended.easyMath, false);
});

test("waterOptions: row statuses and notes", () => {
  const small = options(10, 2, "0.3");
  assert.deepEqual(small.rows.map((r) => r.status), ["ok", "ok", "wont-fit", "wont-fit", "wont-fit"]);
  assert.equal(small.rows[2].note, "At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds.");

  const between = options(12, 2.5);
  assert.equal(between.rows[0].status, "between-marks");
  assert.equal(
    between.rows[0].note,
    "At 1.0 mL, your dose is 20.8 units, between marks. The nearest mark, 20 units, gives 2.4 mg (4% under).",
  );

  const tiny = options(30, 1);
  assert.equal(tiny.rows[0].status, "hard-to-measure");
  assert.equal(tiny.rows[0].note, "At 1.0 mL, your dose is 3.3 units. Misreading by one mark would change it by 60%.");
});

test("waterOptions: no recommendation suggests another syringe", () => {
  const res = options(30, 1);
  assert.equal(res.recommendedMl, null);
  assert.equal(res.rows.some((r) => r.recommended), false);
  assert.deepEqual(res.alternative, { syringe: "0.3", waterMl: 3 });
  assert.deepEqual(codes(res.warnings), ["no-recommendation"]);
  assert.equal(
    res.warnings[0].message,
    "No amount from 1 to 3 mL makes a 1 mg dose easy to measure with a 1 mL syringe. A 0.3 mL syringe works with 3.0 mL of water.",
  );
});

test("waterOptions: no syringe works", () => {
  const res = options(30, 0.25);
  assert.equal(res.alternative, null);
  assert.equal(res.warnings[0].message, "No amount from 1 to 3 mL makes this dose easy to measure with any syringe.");
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
  assert.equal(Calc.formatUnits(huge.rows[0].units), "less than 0.1 units");
  // A whole 0.5 mg vial as one dose: 1.0 mL is exactly 100 units, the most a 1 mL syringe holds.
  const whole = options(0.5, 0.5);
  assert.equal(whole.dosesInVial, 1);
  assert.equal(whole.recommendedMl, 1);
  assert.deepEqual(whole.rows.map((r) => r.status), ["ok", "wont-fit", "wont-fit", "wont-fit", "wont-fit"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL with `TypeError: Calc.measureWater is not a function` and `Calc.waterOptions is not a function`. The earlier 25 tests still pass.

- [ ] **Step 3: Implement the water options**

In `calc.js`, insert this block directly above the line `  const api = {`:

```js
  // --- Mix a vial ----------------------------------------------------------

  function rowNote(status, waterMl, units, check, vialMg, doseMg, syringe) {
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

  function evaluateWater(vialMg, doseMg, waterMl, syringe) {
    const units = unitsFor(vialMg, doseMg, waterMl);
    const unitsPerMg = snap((100 * waterMl) / vialMg);
    const check = assess(units, syringe);
    let status = "ok";
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

  function recommendWater(vialMg, doseMg, syringe) {
    const qualifying = [];
    for (let tenths = MIN_WATER_TENTHS; tenths <= MAX_WATER_TENTHS; tenths++) {
      const option = evaluateWater(vialMg, doseMg, tenths / 10, syringe);
      if (option.status === "ok") qualifying.push(option);
    }
    const easy = qualifying.filter((option) => option.easyMath);
    const pick = (easy.length ? easy : qualifying)[0];
    return pick ? pick.waterMl : null;
  }

  function noRecommendationMessage(doseMg, syringe, alternative) {
    if (!alternative) return "No amount from 1 to 3 mL makes this dose easy to measure with any syringe.";
    return (
      `No amount from 1 to 3 mL makes a ${formatMg(doseMg)} dose easy to measure with a ${SYRINGES[syringe].label} syringe. ` +
      `${capitalize(syringePhrase([alternative.syringe]))} works with ${formatWaterMl(alternative.waterMl)} of water.`
    );
  }

  function waterOptions({ vialMg, doseMg, syringe }) {
    const errors = checkInputs({ vialMg, doseMg }, ["vialMg", "doseMg"]);
    if (errors.length) {
      return { rows: [], recommendedMl: null, alternative: null, dosesInVial: 0, leftoverMg: 0, errors, warnings: [] };
    }

    const recommendedMl = recommendWater(vialMg, doseMg, syringe);
    const amounts = [...TABLE_WATER_ML];
    if (recommendedMl !== null && !amounts.includes(recommendedMl)) amounts.push(recommendedMl);
    amounts.sort((a, b) => a - b);
    const rows = amounts.map((waterMl) => ({
      ...evaluateWater(vialMg, doseMg, waterMl, syringe),
      recommended: waterMl === recommendedMl,
    }));

    const warnings = [];
    let alternative = null;
    if (recommendedMl === null) {
      for (const key of SYRINGE_ORDER) {
        if (key === syringe) continue;
        const waterMl = recommendWater(vialMg, doseMg, key);
        if (waterMl !== null) {
          alternative = { syringe: key, waterMl };
          break;
        }
      }
      warnings.push({ code: "no-recommendation", message: noRecommendationMessage(doseMg, syringe, alternative) });
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

  function measureWater(waterMl, syringe) {
    const { capacityMl } = SYRINGES[syringe];
    const fullSyringes = Math.floor(waterMl / capacityMl + EPS);
    const remainder = snap((waterMl - fullSyringes * capacityMl) * 100);
    return { fullSyringes, remainderUnits: remainder > EPS ? remainder : 0 };
  }

  function describeWaterMeasure(waterMl, syringe) {
    const { fullSyringes, remainderUnits } = measureWater(waterMl, syringe);
    if (fullSyringes === 0) return `Draw to ${formatUnits(remainderUnits)}`;
    const full = `${fullSyringes} full ${fullSyringes === 1 ? "syringe" : "syringes"}`;
    return remainderUnits > 0 ? `${full} + ${formatUnits(remainderUnits)}` : full;
  }
```

Then add `waterOptions,`, `measureWater,` and `describeWaterMeasure,` as the last three entries of the `api` object, after `drawForDose,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `tests 37`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add calc.js test/calc.test.js
git commit -m "Add water options table with recommended amount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The syringe drawing — `syringe.js`

**Files:**
- Create: `syringe.js`
- Test: `test/syringe.test.js`

**Interfaces:**
- Consumes: `Calc.SYRINGES`, `Calc.formatUnits`. In Node through `require("./calc.js")`, in the browser through `window.Calc`, which is why `calc.js` must load first.
- Produces, on `Syringe` (`window.Syringe` in the browser):
  - `unitToY(units, syringe) → number`: the SVG y position. 0 units is `82`, capacity is `502`. Values are clamped.
  - `syringePosition({ syringe, units, state }) → { fillScale, offset, label }`. `state` is `"ok" | "overflow" | "empty"`.
  - `describeSyringe({ syringe, units, state }) → string`: the accessible label.
  - `renderSyringe({ syringe, units, state }) → string`: SVG markup. The root has `class="syr"`, `data-syringe`, `data-state` and `role="img"`. The moving parts are `.syr-fill`, whose transform is set to `scaleY(fillScale)`, and two `.syr-moving` groups, whose transforms are set to `translateY(offset px)`. The dose number is in `.syr-drawlabel`.

- [ ] **Step 1: Write the failing tests**

Create `test/syringe.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Syringe = require("../syringe.js");

const count = (markup, pattern) => (markup.match(pattern) || []).length;

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
  assert.deepEqual(Syringe.syringePosition({ syringe: "1", units: 20, state: "ok" }), { fillScale: 0.2, offset: 84, label: "20" });
  assert.deepEqual(Syringe.syringePosition({ syringe: "1", units: 150, state: "overflow" }), { fillScale: 1, offset: 420, label: "" });
  assert.deepEqual(Syringe.syringePosition({ syringe: "0.3", units: 0, state: "empty" }), { fillScale: 0, offset: 0, label: "" });
  assert.equal(Syringe.syringePosition({ syringe: "1", units: 22.5, state: "ok" }).label, "22.5");
});

test("describeSyringe gives the accessible label", () => {
  assert.equal(Syringe.describeSyringe({ syringe: "1", units: 20, state: "ok" }), "1 mL syringe drawn to 20 units");
  assert.equal(Syringe.describeSyringe({ syringe: "0.3", units: 0, state: "empty" }), "0.3 mL syringe, empty");
  assert.equal(Syringe.describeSyringe({ syringe: "0.5", units: 60, state: "overflow" }), "0.5 mL syringe, dose doesn't fit");
});

test("renderSyringe draws the right ticks and labels for each syringe", () => {
  const expected = { "0.3": [31, 7], "0.5": [51, 11], "1": [51, 11] };
  for (const [syringe, [ticks, labels]] of Object.entries(expected)) {
    const svg = Syringe.renderSyringe({ syringe, units: 0, state: "empty" });
    assert.equal(count(svg, /<line class="syr-tick/g), ticks, `${syringe} ticks`);
    assert.equal(count(svg, /syr-tick-major/g), labels, `${syringe} major ticks`);
    assert.equal(count(svg, /<text class="syr-label"/g), labels, `${syringe} labels`);
  }
});

test("renderSyringe marks state, syringe, label and positions", () => {
  const svg = Syringe.renderSyringe({ syringe: "1", units: 20, state: "ok" });
  assert.match(svg, /^<svg class="syr"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="1 mL syringe drawn to 20 units"/);
  assert.match(svg, /data-syringe="1"/);
  assert.match(svg, /data-state="ok"/);
  assert.match(svg, /class="syr-fill"[^>]*scaleY\(0\.2\)/);
  assert.equal(count(svg, /translateY\(84px\)/g), 2);
  assert.match(svg, /class="syr-drawlabel"[^>]*>20<\/text>/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL with `Cannot find module '../syringe.js'`. All 37 calc tests pass.

- [ ] **Step 3: Write `syringe.js`**

```js
// Draws the upright U-100 syringe as an SVG string. No DOM access.
(function () {
  "use strict";

  const Calc = typeof module !== "undefined" && module.exports ? require("./calc.js") : window.Calc;

  // Geometry in SVG user units. The needle points up; 0 units is the top of the barrel.
  const VIEW_WIDTH = 124;
  const VIEW_HEIGHT = 580;
  const CENTER_X = 60;
  const BARREL_LEFT = 42;
  const BARREL_RIGHT = 78;
  const BARREL_TOP = 80;
  const SCALE_TOP = 82;
  const SCALE_LENGTH = 420;
  const BARREL_BOTTOM = SCALE_TOP + SCALE_LENGTH + 24;
  const STOPPER_HEIGHT = 14;
  const THUMB_TOP = VIEW_HEIGHT - 14;

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  function unitToY(units, syringe) {
    const capacity = Calc.SYRINGES[syringe].capacityUnits;
    const clamped = Math.min(Math.max(units, 0), capacity);
    return round3(SCALE_TOP + (clamped / capacity) * SCALE_LENGTH);
  }

  // Where the moving parts sit. Overflow parks the stopper at capacity.
  function syringePosition({ syringe, units, state }) {
    const capacity = Calc.SYRINGES[syringe].capacityUnits;
    const drawn = state === "empty" ? 0 : state === "overflow" ? capacity : units;
    const offset = round3(unitToY(drawn, syringe) - SCALE_TOP);
    return {
      fillScale: round3(offset / SCALE_LENGTH),
      offset,
      label: state === "ok" ? Calc.formatUnits(units).split(" ")[0] : "",
    };
  }

  function describeSyringe({ syringe, units, state }) {
    const { label } = Calc.SYRINGES[syringe];
    if (state === "empty") return `${label} syringe, empty`;
    if (state === "overflow") return `${label} syringe, dose doesn't fit`;
    return `${label} syringe drawn to ${Calc.formatUnits(units)}`;
  }

  function scaleMarkup(syringe) {
    const { capacityUnits, markSpacing, labelEvery } = Calc.SYRINGES[syringe];
    let markup = "";
    for (let units = 0; units <= capacityUnits; units += markSpacing) {
      const y = unitToY(units, syringe);
      const major = units % labelEvery === 0;
      const x1 = BARREL_RIGHT - (major ? 16 : 8);
      markup += `<line class="syr-tick${major ? " syr-tick-major" : ""}" x1="${x1}" y1="${y}" x2="${BARREL_RIGHT}" y2="${y}"/>`;
      if (major) markup += `<text class="syr-label" x="${BARREL_RIGHT + 6}" y="${y}" dy="0.35em">${units}</text>`;
    }
    return markup;
  }

  function renderSyringe({ syringe, units, state }) {
    const position = syringePosition({ syringe, units, state });
    const innerLeft = BARREL_LEFT + 1.5;
    const innerWidth = BARREL_RIGHT - BARREL_LEFT - 3;
    const scaleBottom = SCALE_TOP + SCALE_LENGTH;
    const moving = `style="transform: translateY(${position.offset}px)"`;
    return (
      `<svg class="syr" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" preserveAspectRatio="xMidYMin meet" role="img"` +
      ` aria-label="${describeSyringe({ syringe, units, state })}" data-syringe="${syringe}" data-state="${state}">` +
      `<line class="syr-needle" x1="${CENTER_X}" y1="6" x2="${CENTER_X}" y2="60"/>` +
      `<rect class="syr-hub" x="${CENTER_X - 7}" y="58" width="14" height="${BARREL_TOP - 58}" rx="2"/>` +
      `<rect class="syr-barrel" x="${BARREL_LEFT}" y="${BARREL_TOP}" width="${BARREL_RIGHT - BARREL_LEFT}" height="${BARREL_BOTTOM - BARREL_TOP}" rx="3"/>` +
      // The rod runs the full length behind the liquid; the opaque fill hides the part above the stopper.
      `<rect class="syr-rod" x="${CENTER_X - 3}" y="${SCALE_TOP}" width="6" height="${THUMB_TOP - SCALE_TOP}"/>` +
      `<rect class="syr-fill" x="${innerLeft}" y="${SCALE_TOP}" width="${innerWidth}" height="${SCALE_LENGTH}" style="transform: scaleY(${position.fillScale})"/>` +
      `<g class="syr-moving syr-plunger" ${moving}>` +
      `<rect class="syr-stopper" x="${innerLeft}" y="${SCALE_TOP}" width="${innerWidth}" height="${STOPPER_HEIGHT}" rx="2"/>` +
      `</g>` +
      scaleMarkup(syringe) +
      `<line class="syr-overflow" x1="${BARREL_LEFT - 6}" y1="${scaleBottom}" x2="${BARREL_RIGHT}" y2="${scaleBottom}"/>` +
      `<g class="syr-moving syr-draw" ${moving}>` +
      `<line class="syr-drawline" x1="${BARREL_LEFT - 6}" y1="${SCALE_TOP}" x2="${BARREL_RIGHT}" y2="${SCALE_TOP}"/>` +
      `<text class="syr-drawlabel" x="${BARREL_LEFT - 10}" y="${SCALE_TOP}" dy="0.35em">${position.label}</text>` +
      `</g>` +
      `<rect class="syr-flange" x="${BARREL_LEFT - 14}" y="${BARREL_BOTTOM}" width="${BARREL_RIGHT - BARREL_LEFT + 28}" height="8" rx="2"/>` +
      `<rect class="syr-thumb" x="${CENTER_X - 16}" y="${THUMB_TOP}" width="32" height="8" rx="2"/>` +
      `</svg>`
    );
  }

  const api = { unitToY, syringePosition, describeSyringe, renderSyringe };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.Syringe = api;
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, `tests 43`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add syringe.js test/syringe.test.js
git commit -m "Add upright syringe SVG renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The page — both tabs, styles and wiring

**Files:**
- Create: `index.html`, `styles.css`, `app.js`, `.claude/launch.json`

**Interfaces:**
- Consumes: `Calc.parseAmount`, `Calc.waterOptions`, `Calc.drawForDose`, `Calc.describeWaterMeasure`, all `Calc.format*` functions, `Syringe.renderSyringe`, `Syringe.syringePosition`, `Syringe.describeSyringe`.
- Produces: the finished page. The element IDs the browser checks rely on are `vial`, `water`, `dose`, `vial-error`, `water-error`, `dose-error`, `answer`, `options`, `math` and `syringe-art`. Radio groups are named `mode` (`mix`/`draw`), `syringe` (`0.3`/`0.5`/`1`) and `water`.

- [ ] **Step 1: Add a local server config for the browser pane**

The built-in browser pane can't script `file://` pages, so checks run against a static server. Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "app",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8765"],
      "port": 8765
    }
  ]
}
```

- [ ] **Step 2: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Retatrutide mixing calculator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="app">
    <header class="masthead">
      <h1>Retatrutide</h1>
      <fieldset>
        <legend class="visually-hidden">Mode</legend>
        <div class="segmented">
          <label><input type="radio" name="mode" value="mix" checked><span>Mix a vial</span></label>
          <label><input type="radio" name="mode" value="draw"><span>Draw a dose</span></label>
        </div>
      </fieldset>
    </header>

    <div class="workspace">
      <div class="controls">
        <div class="field">
          <label for="vial">Vial</label>
          <div class="amount">
            <input id="vial" type="text" inputmode="decimal" autocomplete="off" aria-describedby="vial-error">
            <span class="amount-unit">mg</span>
          </div>
          <p class="field-error" id="vial-error" hidden></p>
        </div>

        <div class="field" data-mode="draw" hidden>
          <label for="water">Water added</label>
          <div class="amount">
            <input id="water" type="text" inputmode="decimal" autocomplete="off" aria-describedby="water-error">
            <span class="amount-unit">mL</span>
          </div>
          <p class="field-error" id="water-error" hidden></p>
        </div>

        <div class="field">
          <label for="dose">Your dose</label>
          <div class="amount">
            <input id="dose" type="text" inputmode="decimal" autocomplete="off" aria-describedby="dose-error">
            <span class="amount-unit">mg</span>
          </div>
          <p class="field-error" id="dose-error" hidden></p>
        </div>

        <fieldset class="field">
          <legend>Syringe</legend>
          <div class="segmented">
            <label><input type="radio" name="syringe" value="0.3"><span>0.3 mL</span></label>
            <label><input type="radio" name="syringe" value="0.5"><span>0.5 mL</span></label>
            <label><input type="radio" name="syringe" value="1" checked><span>1 mL</span></label>
          </div>
        </fieldset>

        <section class="answer" id="answer" aria-live="polite"></section>
      </div>

      <figure class="syringe">
        <div class="syringe-art" id="syringe-art"></div>
        <figcaption>Read at the top edge of the rubber stopper.</figcaption>
      </figure>
    </div>

    <section class="options" id="options" data-mode="mix" aria-label="Water amounts"></section>
    <section class="math" id="math" data-mode="draw" aria-label="How this was worked out" hidden></section>

    <footer class="footnote">This does arithmetic only. Check your numbers with your prescriber or pharmacist.</footer>
  </main>

  <script src="calc.js"></script>
  <script src="syringe.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `styles.css`**

```css
/* Tokens ------------------------------------------------------------------ */

:root {
  --paper: #FBFCFC;
  --ink: #1E2B33;
  --muted: #5E6E78;
  --cap-orange: #F25C05;
  --solution: #D6E9F2;
  --stopper: #2B2F33;
  --caution: #B3261E;
  --barrel: #FFFFFF;
  --rod: #C9D2D8;
  --rule: #D5DDE2;
  --selected: #EEF4F7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #151C21;
    --ink: #E3EAEE;
    --muted: #9AA8B1;
    --cap-orange: #FF7A2E;
    --solution: #2A4A5A;
    --stopper: #AEB8BF;
    --caution: #FF8A80;
    --barrel: #1C252B;
    --rod: #4A5963;
    --rule: #33424C;
    --selected: #1F2A31;
  }
}

/* Base -------------------------------------------------------------------- */

*, *::before, *::after { box-sizing: border-box; }

html {
  color-scheme: light dark;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
}

/* Inputs must inherit 17px: iOS Safari zooms into any field under 16px. */
input { font: inherit; color: inherit; }

[hidden] { display: none !important; }

fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
legend { padding: 0; }

:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Page -------------------------------------------------------------------- */

.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.masthead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
}

/* Segmented radio controls (mode and syringe) */

.segmented {
  display: inline-flex;
  padding: 3px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
}

.segmented label { position: relative; }

.segmented input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.segmented span {
  display: block;
  padding: 5px 13px;
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
}

.segmented input:checked + span {
  background: var(--ink);
  color: var(--paper);
}

.segmented input:focus-visible + span {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

/* Inputs and the syringe, side by side */

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  gap: 16px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.field label,
.field legend {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
}

.amount {
  display: flex;
  align-items: baseline;
  max-width: 10em;
  border-bottom: 2px solid var(--ink);
}

.amount:focus-within { box-shadow: 0 2px 0 var(--ink); }

.amount:has(input[aria-invalid="true"]) { border-bottom-color: var(--caution); }

.amount input {
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  font-size: 27px;
  font-weight: 600;
  outline: none;
}

.amount-unit {
  padding-left: 6px;
  color: var(--muted);
}

.field-error {
  margin: 6px 0 0;
  color: var(--caution);
  font-size: 14px;
}

/* The answer */

.answer {
  padding-top: 16px;
  border-top: 1.5px solid var(--ink);
}

.answer-main {
  margin: 0 0 10px;
  line-height: 1.1;
}

.answer-verb,
.answer-tail {
  display: block;
  font-size: 17px;
  font-weight: 600;
}

.answer-number {
  font-size: 54px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.answer-unit {
  font-size: 27px;
  font-weight: 700;
}

.answer-detail { margin: 4px 0 0; }

.answer-empty {
  margin: 0;
  color: var(--muted);
}

.notices {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.notice {
  padding: 2px 0 2px 12px;
  border-left: 4px solid var(--caution);
}

/* The syringe */

.syringe { margin: 0; }

/* The column width sets the syringe's size; its viewBox sets the height. */
.syringe-art svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 640px;
}

.syringe figcaption {
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.3;
}

.syr-needle { stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
.syr-hub { fill: var(--muted); }
.syr-barrel { fill: var(--barrel); stroke: var(--ink); stroke-width: 1.5; }
.syr-rod { fill: var(--rod); }
.syr-fill { fill: var(--solution); transform-box: fill-box; transform-origin: top; }
.syr-stopper { fill: var(--stopper); }
.syr-tick { stroke: var(--ink); stroke-width: 1; }
.syr-tick-major { stroke-width: 1.5; }
.syr-label { fill: var(--ink); font-size: 12px; font-weight: 600; }
.syr-drawline { stroke: var(--cap-orange); stroke-width: 3; stroke-linecap: round; }
.syr-drawlabel { fill: var(--ink); font-size: 13px; font-weight: 700; text-anchor: end; }
.syr-overflow { stroke: var(--caution); stroke-width: 3; stroke-dasharray: 4 3; }
.syr-flange, .syr-thumb { fill: var(--ink); }

.syr:not([data-state="ok"]) .syr-draw,
.syr:not([data-state="overflow"]) .syr-overflow { display: none; }

.syr-fill,
.syr-moving { transition: transform 250ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .syr-fill,
  .syr-moving { transition: none; }
}

/* Water options table */

.options {
  margin-top: 32px;
  overflow-x: auto;
}

.options-table {
  width: 100%;
  border-collapse: collapse;
}

.options-table th {
  padding: 0 8px 8px 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
}

.options-table td {
  padding: 10px 8px 10px 0;
  border-top: 1px solid var(--rule);
  vertical-align: top;
}

.options-table th:first-child,
.options-table td:first-child { padding-left: 12px; }

.option { cursor: pointer; }
.option.is-selected td { background: var(--selected); }
.option.is-selected td:first-child { box-shadow: inset 4px 0 0 var(--ink); }
.option.is-flagged td:not(:first-child) { color: var(--muted); }
.option:has(input:focus-visible) { outline: 2px solid var(--ink); outline-offset: -2px; }

.option-water label {
  display: block;
  font-weight: 600;
  cursor: pointer;
}

.option-water input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.option-status {
  display: block;
  color: var(--muted);
  font-size: 14px;
}

.option-status.is-recommended {
  color: var(--ink);
  font-weight: 600;
}

/* On phones the answer already shows the strength, so the table drops that column. */
@media (max-width: 480px) {
  .options-table th:nth-child(2),
  .options-table td:nth-child(2) { display: none; }
}

/* Worked math */

.math { margin-top: 32px; }

.math h2 {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
}

.math-steps {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.footnote {
  max-width: 40em;
  margin-top: 40px;
  color: var(--muted);
  font-size: 14px;
}

/* Wider screens: same layout, bigger syringe */

@media (min-width: 640px) {
  .app { padding-top: 40px; }
  h1 { font-size: 27px; }
  .workspace {
    grid-template-columns: minmax(0, 1fr) 160px;
    gap: 40px;
  }
}
```

- [ ] **Step 4: Write `app.js`**

```js
// Connects the page to calc.js and syringe.js. All math lives in calc.js.
(function () {
  "use strict";

  const Calc = window.Calc;
  const Syringe = window.Syringe;

  const fields = {
    vialMg: document.getElementById("vial"),
    waterMl: document.getElementById("water"),
    doseMg: document.getElementById("dose"),
  };
  const fieldErrors = {
    vialMg: document.getElementById("vial-error"),
    waterMl: document.getElementById("water-error"),
    doseMg: document.getElementById("dose-error"),
  };
  const answer = document.getElementById("answer");
  const optionsSection = document.getElementById("options");
  const mathSection = document.getElementById("math");
  const syringeArt = document.getElementById("syringe-art");

  const PROMPTS = {
    mix: "Enter your vial and dose to see how much water to add.",
    draw: "Enter your vial, water and dose to see where to draw.",
  };
  const STATUS_TEXT = {
    "wont-fit": "Won't fit",
    "hard-to-measure": "Hard to measure",
    "between-marks": "Between marks",
  };

  // The water amount tapped in the table. null means "use the recommendation".
  let selectedWaterMl = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function checkedValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`).value;
  }

  function readValues() {
    return {
      vialMg: Calc.parseAmount(fields.vialMg.value),
      waterMl: Calc.parseAmount(fields.waterMl.value),
      doseMg: Calc.parseAmount(fields.doseMg.value),
      syringe: checkedValue("syringe"),
    };
  }

  // Field errors appear only once something is typed, so an empty form stays calm.
  function showFieldErrors(errors) {
    for (const key of Object.keys(fields)) {
      const error = errors.find((e) => e.field === key);
      const message = error && fields[key].value.trim() !== "" ? error.message : "";
      fieldErrors[key].textContent = message;
      fieldErrors[key].hidden = !message;
      fields[key].setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  // "40 units" -> a big "40" and a smaller "units".
  function bigFigure(verb, text, tail) {
    const line = el("p", "answer-main");
    line.append(el("span", "answer-verb", verb));
    const match = /^([\d.]+) (.+)$/.exec(text);
    if (match) line.append(el("span", "answer-number", match[1]), el("span", "answer-unit", ` ${match[2]}`));
    else line.append(el("span", "answer-unit", text));
    if (tail) line.append(el("span", "answer-tail", tail));
    return line;
  }

  function noticeList(messages) {
    const list = el("ul", "notices");
    for (const message of messages) list.append(el("li", "notice", message));
    return list;
  }

  function showEmpty(mode, errors, syringe) {
    const general = errors.filter((e) => !e.field).map((e) => e.message);
    answer.replaceChildren(general.length ? noticeList(general) : el("p", "answer-empty", PROMPTS[mode]));
    showSyringe(syringe, 0, "empty");
  }

  // Re-render only when the syringe size changes, so the plunger can slide between doses.
  function showSyringe(syringe, units, state) {
    const svg = syringeArt.querySelector("svg");
    if (!svg || svg.dataset.syringe !== syringe) {
      syringeArt.innerHTML = Syringe.renderSyringe({ syringe, units, state });
      return;
    }
    const position = Syringe.syringePosition({ syringe, units, state });
    svg.dataset.state = state;
    svg.setAttribute("aria-label", Syringe.describeSyringe({ syringe, units, state }));
    svg.querySelector(".syr-fill").style.transform = `scaleY(${position.fillScale})`;
    for (const group of svg.querySelectorAll(".syr-moving")) {
      group.style.transform = `translateY(${position.offset}px)`;
    }
    svg.querySelector(".syr-drawlabel").textContent = position.label;
  }

  function optionsTable(rows, selected) {
    const table = el("table", "options-table");
    table.append(el("caption", "visually-hidden", "Water amounts to choose from"));
    const headRow = el("tr");
    for (const title of ["Water", "Strength", "Dose", "1 mg ="]) {
      const th = el("th", null, title);
      th.scope = "col";
      headRow.append(th);
    }
    const head = el("thead");
    head.append(headRow);

    const body = el("tbody");
    for (const row of rows) {
      const tr = el("tr", "option");
      tr.classList.toggle("is-selected", row === selected);
      tr.classList.toggle("is-flagged", row.status !== "ok");

      const radio = el("input");
      radio.type = "radio";
      radio.name = "water";
      radio.value = String(row.waterMl);
      radio.checked = row === selected;
      const label = el("label");
      label.append(radio, Calc.formatWaterMl(row.waterMl));
      const waterCell = el("td", "option-water");
      waterCell.append(label);
      if (row.recommended) waterCell.append(el("span", "option-status is-recommended", "★ Recommended"));
      else if (STATUS_TEXT[row.status]) waterCell.append(el("span", "option-status", STATUS_TEXT[row.status]));

      tr.append(
        waterCell,
        el("td", null, Calc.formatConcentration(row.concentration)),
        el("td", null, Calc.formatUnits(row.units)),
        el("td", null, Calc.formatUnits(row.unitsPerMg)),
      );
      body.append(tr);
    }
    table.append(head, body);
    return table;
  }

  function renderMix(values) {
    const res = Calc.waterOptions(values);
    showFieldErrors(res.errors);
    optionsSection.replaceChildren();
    if (res.errors.length) {
      showEmpty("mix", res.errors, values.syringe);
      return;
    }

    const selected =
      res.rows.find((row) => row.waterMl === selectedWaterMl) ||
      res.rows.find((row) => row.recommended) ||
      res.rows[0];

    answer.replaceChildren(
      bigFigure("Add", Calc.formatWaterMl(selected.waterMl), "of bacteriostatic water"),
      el("p", "answer-detail", `Measure: ${Calc.describeWaterMeasure(selected.waterMl, values.syringe)}`),
      el("p", "answer-detail", `Makes ${Calc.formatConcentration(selected.concentration)}. Your dose: ${Calc.formatUnits(selected.units)}.`),
      el("p", "answer-detail", `${Calc.formatDoses(res.dosesInVial, res.leftoverMg)}.`),
    );
    const messages = res.warnings.map((w) => w.message);
    if (selected.note) messages.push(selected.note);
    if (messages.length) answer.append(noticeList(messages));

    showSyringe(values.syringe, selected.units, selected.status === "wont-fit" ? "overflow" : "ok");
    optionsSection.append(optionsTable(res.rows, selected));
  }

  function renderDraw(values) {
    const res = Calc.drawForDose(values);
    showFieldErrors(res.errors);
    mathSection.replaceChildren();
    if (!res.result) {
      showEmpty("draw", res.errors, values.syringe);
      return;
    }

    const r = res.result;
    answer.replaceChildren(
      bigFigure("Draw to", Calc.formatUnits(r.units)),
      el("p", "answer-detail", `${Calc.formatMl(r.ml)} at ${Calc.formatConcentration(r.concentration)}. ${Calc.formatDoses(r.dosesInVial, r.leftoverMg)}.`),
    );
    if (r.nearestMarkText) answer.append(el("p", "answer-detail", r.nearestMarkText));
    const messages = [...res.errors, ...res.warnings].map((m) => m.message);
    if (messages.length) answer.append(noticeList(messages));

    showSyringe(values.syringe, r.units, r.fits ? "ok" : "overflow");

    const steps = el("ol", "math-steps");
    for (const line of r.workedMath) steps.append(el("li", null, line));
    mathSection.append(el("h2", null, "How this was worked out"), steps);
  }

  function render() {
    const mode = checkedValue("mode");
    for (const node of document.querySelectorAll("[data-mode]")) node.hidden = node.dataset.mode !== mode;
    const values = readValues();
    if (mode === "mix") renderMix(values);
    else renderDraw(values);
  }

  document.addEventListener("input", (event) => {
    if (!event.target.matches(".amount input")) return;
    selectedWaterMl = null;
    render();
  });

  document.addEventListener("change", (event) => {
    const { name } = event.target;
    if (name === "syringe") selectedWaterMl = null;
    if (name === "water") selectedWaterMl = Number(event.target.value);
    if (name === "syringe" || name === "mode" || name === "water") render();
    // The table is rebuilt on render; put focus back so arrow keys keep working.
    if (name === "water") optionsSection.querySelector('input[name="water"]:checked').focus();
  });

  // Tapping anywhere on a row picks it, not just the water amount.
  optionsSection.addEventListener("click", (event) => {
    const row = event.target.closest("tr.option");
    if (!row || event.target.closest("label")) return;
    const radio = row.querySelector('input[name="water"]');
    if (radio.checked) return;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  });

  render();
})();
```

- [ ] **Step 5: Run the unit tests**

Run: `node --test`
Expected: PASS, `tests 43`, `fail 0`. The page code adds no tests of its own; the next step checks it in a browser.

- [ ] **Step 6: Check the page in the browser**

Start the `app` preview (`preview_start` with name `app`), set the tab to the `mobile` preset in light mode, and reload. Run each check below with the browser's JavaScript tool. Every check starts with this helper, and each check reloads the page first so it starts from an empty form:

```js
const set = (id, v) => { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); };
const wait = () => new Promise((r) => setTimeout(r, 300));
```

- **5-a, empty form.** `document.getElementById("answer").innerText` is `Enter your vial and dose to see how much water to add.` `[...document.querySelectorAll(".field-error")].every((e) => e.hidden)` is `true`. `document.querySelector(".syr").dataset.state` is `"empty"`.
- **5-b, the main case.** `set("vial","10"); set("dose","2"); await wait();`
  - The answer contains `1.0 mL`, `Measure: 1 full syringe`, `Makes 10 mg/mL. Your dose: 20 units.` and `5 doses in the vial.`
  - `.syr` has `data-state="ok"` and `aria-label="1 mL syringe drawn to 20 units"`.
  - There are 5 `tr.option` rows. The first contains `★ Recommended` and has the class `is-selected`.
- **5-c, field errors (Review Focus 2).**
  - `set("vial","abc"); await wait();` → `#vial-error` is not hidden and reads `Enter the vial amount in mg.`, and `#vial` has `aria-invalid="true"`.
  - Then `set("vial",""); await wait();` → `#vial-error` is hidden, and the answer shows the empty prompt again.
- **5-d, selection resets (Review Focus 3).**
  - `set("vial","12"); set("dose","2.5"); await wait();` → the water column reads `1.0, 1.5, 2.0, 2.4, 2.5, 3.0 mL`, and the selected row is `2.4 mL`.
  - Click the third cell of the `2.0 mL` row (`document.querySelectorAll("tr.option")[2].querySelector("td:nth-child(3)").click()`) and wait → the answer contains `2.0 mL`, the `.is-selected` row starts with `2.0 mL`, and the answer shows the note `At 2.0 mL, your dose is 41.7 units, between marks.`
  - `set("dose","2"); await wait();` → the selection is back on the new recommendation, `1.2 mL`, and the answer contains `1.2 mL`.
- **5-e, won't fit.** `set("vial","10"); set("dose","2");`, click the `0.3` syringe radio (`document.querySelector('input[name="syringe"][value="0.3"]').click()`), then click the `2.0 mL` row's third cell and wait.
  - `.syr` has `data-state="overflow"`.
  - The answer contains `Measure: 6 full syringes + 20 units` and `At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds.`
- **5-f, no iOS input zoom (Review Focus 4).** `getComputedStyle(document.getElementById("vial")).fontSize` is `"27px"`.
- **5-g, the Draw tab.** Click the `draw` mode radio, then `set("vial","10"); set("water","1"); set("dose","1.8"); await wait();`
  - The answer contains `18 units`, `0.18 mL at 10 mg/mL.` and `Each mark on this syringe is 2 units, so misreading by one mark changes this dose by 11%.`
  - `#math` lists `10 mg ÷ 1.0 mL = 10 mg/mL`, `1.8 mg ÷ 10 mg/mL = 0.18 mL` and `0.18 mL × 100 = 18 units`.
  - `#options` is hidden.
- **5-h, no sideways scroll.** In each state above, `document.documentElement.scrollWidth` is `375`.

If a check fails, fix the page code, reload, and run all the checks again.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css app.js .claude/launch.json
git commit -m "Add the calculator page with Mix a vial and Draw a dose tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Visual review and final checks

**Files:**
- Modify, only if a check finds a problem: `styles.css`, `app.js`, `index.html`.

**Interfaces:**
- Consumes: the finished page from Task 5.
- Produces: screenshots confirming the design, and fixes for anything that doesn't match the spec.

- [ ] **Step 1 (6-a): Screenshot review against the spec**

Take a screenshot of each state below in the built-in browser and compare it with the spec's Visual design section:
1. 375px, light, Mix tab, 10 mg vial and 2 mg dose.
2. 375px, dark, Draw tab, 10 mg vial, 1 mL water and 1.8 mg dose, which shows the warning.
3. Desktop width, light, Mix tab, 12 mg vial and 2.5 mg dose, which shows the 2.4 mL extra row and the Strength column.
4. 375px, light, Mix tab, won't fit: 0.3 mL syringe with the 2.0 mL row selected.

For each one, confirm:
- Orange appears only on the draw line.
- The syringe stands next to the inputs, with its caption directly underneath.
- There are no all-caps labels.
- Every number shows its unit.
- The answer is the largest text on the page.
- Nothing wraps awkwardly: no table cell splits "10 units" across two lines.

The token contrast was checked while writing this plan:

| Pair | Light | Dark |
|---|---|---|
| Ink on paper | 14.1 | 14.2 |
| Muted on paper | 5.1 | 7.1 |
| Muted on the selected row | 4.8 | 6.0 |
| Caution on paper | 6.4 | 7.5 |
| Orange line on barrel (graphic, needs 3:1) | 3.3 | 6.0 |

If you change a colour, recheck these pairs.

Fix anything that fails, then reset the viewport to `desktop`.

- [ ] **Step 2 (6-b): Extreme inputs (Review Focus 5)**

At 375px:
- Mix tab, `vial` = `100000`, `dose` = `0.001` → every row's dose reads `less than 0.1 units`, the answer shows `No amount from 1 to 3 mL makes this dose easy to measure with any syringe.`, and `document.documentElement.scrollWidth` is `375`.
- Draw tab, `vial` = `10`, `water` = `3`, `dose` = `10` → the answer shows `Draw to 300 units` and `300 units won't fit in a 1 mL (100-unit) syringe. Split it into 3 draws.`, `scrollWidth` is `375`, and the syringe is in the overflow state.

- [ ] **Step 3 (6-c): Keyboard**

Load the page, press Tab repeatedly and confirm:
- A visible focus outline moves through: Mix/Draw → vial → dose → syringe → water rows.
- Arrow keys move between the water rows, and the answer and syringe follow.
- Space or Enter is never needed to see a result.

- [ ] **Step 4 (6-d): Opens straight from disk**

Open `file:///Users/spaceplushy/development/reconstitutor/index.html` with the Playwright browser tools (`browser_navigate`, then `browser_evaluate`), set the vial to 10 and the dose to 2 as in check 5-b, and confirm that `#answer` contains `1.0 mL`. This proves the plain scripts load from `file://`. If Playwright can't open `file://` URLs, ask the user to double-click `index.html` and say whether "Add 1.0 mL" appears after typing 10 and 2.

- [ ] **Step 5: Run the full test suite**

Run: `node --test`
Expected: PASS, `tests 43`, `fail 0`.

- [ ] **Step 6: Commit any fixes**

If steps 1 to 4 changed any files:

```bash
git add index.html styles.css app.js
git commit -m "Polish layout after visual review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If nothing changed, skip this commit and note "no fixes needed" in the task report.
