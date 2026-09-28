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
