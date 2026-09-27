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
