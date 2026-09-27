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
