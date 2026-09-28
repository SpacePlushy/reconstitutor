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
