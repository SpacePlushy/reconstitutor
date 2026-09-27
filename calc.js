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
