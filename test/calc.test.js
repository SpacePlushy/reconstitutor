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

// --- display edge cases found in review -----------------------------------

test("formatUnits adds decimals instead of rounding an off-mark dose to a whole number", () => {
  assert.equal(Calc.formatUnits(26.041666667), "26.04 units");
  assert.equal(Calc.formatUnits(19.95), "19.95 units");
  assert.equal(Calc.formatUnits(20.004), "20.004 units");
  assert.equal(Calc.formatUnits(20.8333), "20.8 units");
  assert.equal(Calc.formatUnits(30.000000000000004), "30 units");
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
  assert.equal(result.units, 19.95);
  assert.equal(result.workedMath[2], "0.1995 mL × 100 = 19.95 units");
  assert.equal(result.nearestMarkText, "Nearest mark: 20 units = 2.857 mg (less than 1% over)");
});

test("drawForDose: a tiny dose never shows 0.00 mL", () => {
  const { result } = draw(10, 1, 0.004);
  assert.deepEqual(result.workedMath.slice(1), [
    "0.004 mg ÷ 10 mg/mL = less than 0.001 mL",
    "less than 0.001 mL × 100 = less than 0.1 units",
  ]);
});

test("waterOptions: a between-marks row never displays as a whole mark", () => {
  const row = options(12, 1.25).rows.find((r) => r.waterMl === 2.5);
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
