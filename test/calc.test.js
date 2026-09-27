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
