# Retatrutide reconstitution calculator — design

Date: 2026-09-26
Status: implemented. Its **Visual design** and **Architecture** sections are superseded by [2026-09-27-react-typescript-migration-design.md](2026-09-27-react-typescript-migration-design.md); everything else still applies.

## Purpose

A personal web app that answers one question: **how much bacteriostatic water should I add to this vial of dry retatrutide?** A second tab converts a dose into syringe units for a vial that is already mixed.

The app does arithmetic only. It never suggests a dose; the user types their own.

### Understanding

What the user said:
- Personal tool, used only by them.
- Medication: dry powdered retatrutide, dosed in **mg**, reconstituted with **mL** of bacteriostatic water.
- Syringes vary, so the app needs a syringe picker.
- Calculator only: nothing is saved between visits.
- Main job: decide how much water to add to an unmixed vial.
- Water amount is chosen from an options table with one recommended row.
- The site should look deliberate and polished (frontend-design skill).

Assumptions (confirmed during design review):
- Syringes are U-100 insulin syringes: 0.3 mL (30 units), 0.5 mL (50 units), 1 mL (100 units).
- Vials hold at least 3 mL, so water options stop at 3.0 mL.
- The powder's own volume is ignored.
- Used mostly on a phone.

### Success criteria

- Entering vial mg, dose mg and syringe gives a recommended water amount, how to measure it, and where the dose will sit on the syringe.
- Every number shown matches the formulas below, confirmed by automated tests.
- Mistakes that cause bad doses (dose bigger than vial, dose too big for syringe, dose too small to measure, dose between marks) produce a plain-language warning with a next step.
- ~~Opening `index.html` directly from disk works with no server and no install.~~ Superseded by the React + TypeScript rebuild.

## Out of scope

Saving vials or settings, a dose log, mcg or IU units, other medications, titration schedules, dose suggestions, accounts, a server.

## Domain rules

### Syringes

| Syringe | Capacity | Mark spacing | Labelled every |
|---|---|---|---|
| 0.3 mL | 30 units | 1 unit | 5 units |
| 0.5 mL | 50 units | 1 unit | 5 units |
| 1 mL | 100 units | 2 units | 10 units |

U-100 means 100 units = 1 mL, so 1 unit = 0.01 mL.

### Formulas

Inputs: `V` vial amount (mg), `W` water (mL), `D` dose (mg).

- Concentration: `C = V / W` (mg/mL)
- Draw volume: `mL = D / C = D × W / V`
- Syringe units: `units = mL × 100`
- Units per mg: `unitsPerMg = 100 / C = 100 × W / V`
- Doses in vial: `floor(V / D)` full doses, plus `V − n × D` mg left over
- Nearest mark: `round(units / spacing) × spacing`
- Dose at nearest mark: `nearestMark / 100 × C`, and percent off: `(doseAtMark − D) / D`

Floating-point tolerance: a value within `1e-6` of a whole mark counts as on the mark, and comparisons against capacity use the same tolerance. For example, `30.000000000000004` units is exactly 30 units.

### Measurability

A dose is **measurable** on a syringe when it is at least 10 marks' worth, so misreading by one mark changes the dose by 10% or less:
- 1 mL syringe: at least 20 units
- 0.3 and 0.5 mL syringes: at least 10 units

A dose is **on a mark** when its units are a whole multiple of the syringe's mark spacing, within the tolerance above.

A dose **fits** when its units are at most the syringe's capacity.

## Tab 1: Mix a vial (default)

Inputs: vial amount (mg), your dose (mg), syringe.

### Options table

Rows always shown: water of 1.0, 1.5, 2.0, 2.5 and 3.0 mL. Each row shows:
- Water (mL, one decimal), with a status under it: ★ Recommended, Between marks, Hard to measure or Won't fit
- Strength (mg/mL). Hidden at widths of 480px and below, where the answer shows it instead.
- Dose (units)
- `1 mg = N units`

### Recommended amount

Candidates are every water amount from 1.0 to 3.0 mL in 0.1 mL steps. Build them as `i / 10` for `i = 10…30` so rounding errors can't creep in. A candidate qualifies when the dose **fits**, is **on a mark** and is **measurable** on the chosen syringe.

Among the candidates that qualify, pick:
1. Those whose `unitsPerMg` is one of 5, 10, 20, 25, 50 or 100 ("easy math"), if any.
2. Then the smallest water amount.

If the recommended amount isn't a half-mL step, it's added to the table as an extra row, in water order.

The recommended row starts selected. Tapping any other row selects it instead. The answer and the syringe always show the selected row.

If no candidate qualifies, no row is starred. The app checks the other syringes in the order 0.3, 0.5, 1 mL, and suggests the first one with a recommended amount. Example: "No amount from 1 to 3 mL makes a 1 mg dose easy to measure with a 1 mL syringe. A 0.3 mL syringe works with 3.0 mL of water." If no syringe works, it says: "No amount from 1 to 3 mL makes this dose easy to measure with any syringe." With no recommendation, the 1.0 mL row is selected.

Each row shows at most one problem status, in this order of priority: "won't fit", then "hard to measure", then "between marks".

### Answer

For the selected row:
- **Add X mL of bacteriostatic water**, shown large.
- The strength it makes, for your vial label: "Makes 5 mg/mL."
- If the selected row has a problem, its note, such as "At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds."
- "Measure:" followed by how to measure the water with the chosen syringe: `full = floor(W / capacityMl)` plus the remaining units. The wording is "1 full syringe", "3 full syringes", "1 full syringe + 50 units" or "2 full syringes + 40 units". Water is at least 1.0 mL and no syringe holds more than 1 mL, so there is always at least one full syringe. Water comes in 0.1 mL steps, so the remainder is a multiple of 10 units and always sits on a mark.
- Your dose: N units, and doses in the vial.

### Errors

- Missing, zero, negative or non-numeric input: no table, and the field gets a message such as "Enter the vial amount in mg."
- Dose bigger than the whole vial: "Your dose is more than the whole vial (10 mg)."

## Tab 2: Draw a dose

Inputs: vial amount (mg), water added (mL), your dose (mg), syringe.

Output:
- **Draw to N units**, shown large, plus the volume in mL.
- Concentration and doses in the vial.
- If the dose isn't on a mark: "Nearest mark: 40 units = 2 mg (3% over)." Example: 10 mg vial, 2 mL water, 1.95 mg dose is 39 units, and a 1 mL syringe has no 39 mark. Halfway cases round up to the higher mark.
- The worked math, three lines, for example:
  - `10 mg ÷ 2.0 mL = 5 mg/mL`
  - `2 mg ÷ 5 mg/mL = 0.40 mL`
  - `0.40 mL × 100 = 40 units`

Warnings and errors:
- **Error, dose bigger than vial:** as in Tab 1.
- **Error, won't fit:** "40 units won't fit in a 0.3 mL (30-unit) syringe. Use a 0.5 mL or 1 mL syringe, or split it into 2 draws." It names only bigger syringes the dose fits in. If there are none: "Split it into 2 draws." The number of draws is rounded up.
- **Warning, hard to measure:** "Each mark on this syringe is 2 units, so misreading by one mark changes this dose by 11%. A 0.3 mL or 0.5 mL syringe reads more finely." Shown when the dose isn't measurable. It only suggests syringes the dose is measurable on and fits in. If there are none: "Mixing your next vial with more water makes each dose bigger and easier to measure."
- **No separate between-marks warning.** A measurable dose can never be more than 5% from its nearest mark: at most half a mark off, on at least 10 marks. So the 5% warning planned earlier could never appear. The "Nearest mark" line covers it. That line is hidden when the nearest mark is 0.
- Missing or invalid input: same as Tab 1.

## Shared behaviour

- Vial, dose and syringe values are shared between the tabs. Switching tabs keeps them.
- Results update as you type. There is no submit button.
- Input accepts `.` or `,` as the decimal separator. Fields use `inputmode="decimal"`.
- A field shows its error only for text that can't become a number. Text such as `0` or `0.`, typed on the way to `0.5`, shows no error.
- Nothing is stored. Reloading the page clears it.
- One quiet footer line: "This does arithmetic only. Check your numbers with your prescriber or pharmacist."

## Number formatting

- Every number shows its unit, and decimals always have a leading zero.
- Water amounts: at least 1 decimal, up to 2, so a typed 1.25 mL isn't shown rounded (`1.0 mL`, `2.4 mL`, `1.25 mL`).
- Draw volume: 2 decimals, or more when needed, so it always agrees with the units (`0.40 mL`, `0.395 mL`, `0.1995 mL`). A real volume that would round to 0 shows as `less than 0.001 mL`.
- Units: up to 1 decimal, trailing `.0` removed (`40 units`, `22.5 units`, `1 unit`). If 1 decimal would show a dose that isn't on a mark as a whole number, up to 3 decimals are shown, so 26.04 units never reads as the 26 mark (`26.04 units`, `19.95 units`). A dose that would round to 0 shows as `less than 0.1 units`, and as `<0.1` on the syringe label.
- A number and its unit never wrap onto separate lines.
- Concentration: up to 2 decimals, trailing zeros removed (`5 mg/mL`, `6.67 mg/mL`).
- mg: up to 3 decimals, trailing zeros removed (`2 mg`, `0.25 mg`, `1.9 mg`).
- Percent: whole number (`5% under`, `3% over`).

## Visual design

### Concept

The syringe is the answer. It stands upright, needle at the top, in a column on the right beside the inputs: the same way you see it while drawing from an upside-down vial. It stays visible while you type, and the plunger slides to the new mark when a number changes.

```
Retatrutide
[ Mix a vial | Draw a dose ]
                                ┃
Vial        [ 10 ] mg          ┌┴┐
Your dose   [ 2  ] mg          ├ 0
Syringe  (0.3)(0.5)(1 mL)      ├ 10
                               ├ 20 ◀━ orange
Add 1.0 mL of water            ███
One full 1 mL syringe          └┬┘
Your dose: 20 units, 5 doses    ┃

Water    Strength    Dose       1 mg =
1.0 mL   10 mg/mL    20 units   10 units  ★
1.5 mL   6.67 mg/mL  30 units   15 units
2.0 mL   5 mg/mL     40 units   20 units
2.5 mL   4 mg/mL     50 units   25 units
3.0 mL   3.33 mg/mL  60 units   30 units
```

Single column, left-aligned. On wider screens the same layout scales up inside a centred column. The syringe picker shares its column's width (up to 18em), so it never runs into the syringe. At 340px and narrower, the syringe column shrinks to 88px and the picker labels to 15px.

### Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#FBFCFC` | `#151C21` | Page background |
| ink | `#1E2B33` | `#E3EAEE` | Text, syringe markings |
| muted | `#5E6E78` | `#9AA8B1` | Secondary text |
| cap-orange | `#F25C05` | `#FF7A2E` | The draw line only |
| solution | `#D6E9F2` | `#2A4A5A` | Liquid in the barrel |
| stopper | `#2B2F33` | `#AEB8BF` | Plunger rubber stopper |
| caution | `#B3261E` | `#FF8A80` | Errors and warnings |

Dark mode follows `prefers-color-scheme`.

### Type

- Atkinson Hyperlegible Next (Google Fonts), falling back to `system-ui`. One family only.
- Body 17px. Scale: 14 / 17 / 21 / 27 / 34, and 54 for the main answer.
- Weights: 400 body, 600 labels, 700 answer.
- Tabular figures where the font supports them.

### Rules

1. The syringe is the one bold element; everything else is quiet.
2. Orange only ever means "draw here".
3. A caption under the syringe: "Read at the top edge of the rubber stopper."
4. Warnings say what to do next, calmly, with a caution-coloured left rule and text in ink.
5. The only motion is the plunger and fill sliding (about 250 ms), turned off under `prefers-reduced-motion`.
6. No all-caps labels, no decorative cards, no gradients.

### Syringe drawing

- SVG, vertical. Needle at the top, 0 at the top of the barrel, units increasing downward.
- Minor ticks at every mark, labelled ticks per the syringe table.
- Solution fill from 0 to the dose; stopper just below the fill; plunger rod below.
- Orange line at the dose, with the dose number in bold ink just left of the barrel.
- Won't fit: fill to capacity, no orange line, caution colour at the bottom.
- No valid result: empty barrel, stopper at 0.
- `role="img"` with a label such as "1 mL syringe drawn to 20 units".

### Accessibility

- Every input has a visible label.
- Tabs and syringe choice are radio groups. Table rows are radio inputs styled as rows.
- Visible keyboard focus.
- The answer region is `aria-live="polite"`.
- Text meets WCAG AA contrast in both themes.

## Architecture

No build step, no dependencies. Plain scripts rather than ES modules, because browsers block module scripts on pages opened from disk.

```
reconstitutor/
├── index.html          page layout: both tabs, inputs, syringe slot
├── styles.css          tokens, type, layout, dark mode
├── calc.js             all math and number formatting; no DOM
├── syringe.js          builds the syringe SVG string; no DOM access
├── app.js              reads inputs, calls calc.js and syringe.js, updates the page
└── test/
    ├── calc.test.js
    └── syringe.test.js
```

`calc.js` and `syringe.js` end with:

```js
if (typeof module !== "undefined" && module.exports) module.exports = api;
else window.Calc = api; // window.Syringe in syringe.js
```

### calc.js interface

- `SYRINGES`: the syringe table above, keyed `"0.3"`, `"0.5"`, `"1"`.
- `parseAmount(text)`: number, or `null` for empty, non-numeric, zero or negative input. Accepts `,` as a decimal point.
- `drawForDose({ vialMg, waterMl, doseMg, syringe })`: concentration, mL, units, on-mark flag, nearest mark with its dose and percent off, doses in vial and leftover, and lists of errors and warnings.
- `waterOptions({ vialMg, doseMg, syringe })`: table rows (with status flags), the recommended water amount or `null`, an alternative `{ syringe, waterMl }` or `null`, and errors.
- `measureWater(waterMl, syringe)`: `{ fullSyringes, remainderUnits }`.
- Formatters: `formatMl`, `formatWaterMl`, `formatUnits`, `formatMg`, `formatConcentration`, `formatPercentOff`.

Errors and warnings are objects `{ code, message }`, so tests check the code and the page shows the message.

### syringe.js interface

- `unitToY(units, syringe)`: pixel position in the SVG.
- `renderSyringe({ syringe, units, state })`: SVG markup. `state` is `"ok"`, `"overflow"` or `"empty"`.

## Testing

Tests are written before the code they test. They run with `node --test`, with no dependencies.

`calc.test.js` covers:
- 10 mg / 2 mL / 2 mg gives 5 mg/mL, 0.40 mL, 40 units, 5 doses.
- Nearest-mark rounding on all three syringes, including 2-unit marks on the 1 mL.
- Floating-point cases, such as 5 mg / 3 mL / 0.5 mg giving exactly 30 units and on a mark.
- Every error and warning code, with thresholds tested on both sides.
- `parseAmount` for empty, zero, negative, text and comma input.
- Water options:
  - 10 mg / 2 mg / 1 mL recommends 1.0 mL.
  - 12 mg / 2.5 mg / 1 mL recommends 2.4 mL, added as an extra row.
  - 12 mg / 2.5 mg / 0.5 mL recommends 1.2 mL.
  - 30 mg / 1 mg / 1 mL has no recommendation, and the alternative is the 0.3 mL syringe with 3.0 mL.
- `measureWater` for whole syringes and remainders on each syringe, such as 1.0 mL on a 0.3 mL syringe giving 3 full + 10 units.
- Every formatter.

`syringe.test.js` covers `unitToY` at 0 and at capacity, and the right number of ticks and labels for each syringe.

Visual check: open the page in the built-in browser and screenshot it at 375px and desktop widths, in light and dark mode. Fix problems before calling the work done.

## Version control

`git init`, with the spec and each finished step committed.
