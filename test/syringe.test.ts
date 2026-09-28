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
