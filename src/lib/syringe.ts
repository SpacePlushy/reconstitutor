// Geometry for the upright U-100 syringe drawing. Numbers only; SyringeDiagram draws it.
import { SYRINGES, formatUnits, formatUnitsNumber, type SyringeKey } from "@/lib/calc";

export type SyringeState = "ok" | "overflow" | "empty";

export interface SyringeView {
  syringe: SyringeKey;
  units: number;
  state: SyringeState;
}

export interface ScaleMark {
  units: number;
  y: number;
  major: boolean;
}

// Geometry in SVG user units. The needle points up; 0 units is the top of the barrel.
export const VIEW_WIDTH = 124;
export const VIEW_HEIGHT = 580;
export const CENTER_X = 60;
export const BARREL_LEFT = 42;
export const BARREL_RIGHT = 78;
export const BARREL_TOP = 80;
export const SCALE_TOP = 82;
export const SCALE_LENGTH = 420;
export const BARREL_BOTTOM = SCALE_TOP + SCALE_LENGTH + 24;
export const STOPPER_HEIGHT = 14;
export const THUMB_TOP = VIEW_HEIGHT - 14;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function unitToY(units: number, syringe: SyringeKey): number {
  const capacity = SYRINGES[syringe].capacityUnits;
  const clamped = Math.min(Math.max(units, 0), capacity);
  return round3(SCALE_TOP + (clamped / capacity) * SCALE_LENGTH);
}

// Where the moving parts sit. Overflow parks the stopper at capacity.
export function syringePosition({ syringe, units, state }: SyringeView): {
  fillScale: number;
  offset: number;
  label: string;
} {
  const capacity = SYRINGES[syringe].capacityUnits;
  const drawn = state === "empty" ? 0 : state === "overflow" ? capacity : units;
  const offset = round3(unitToY(drawn, syringe) - SCALE_TOP);
  return {
    fillScale: round3(offset / SCALE_LENGTH),
    offset,
    label: state === "ok" ? formatUnitsNumber(units) : "",
  };
}

export function describeSyringe({ syringe, units, state }: SyringeView): string {
  const { label } = SYRINGES[syringe];
  if (state === "empty") return `${label} syringe, empty`;
  if (state === "overflow") return `${label} syringe, dose doesn't fit`;
  return `${label} syringe drawn to ${formatUnits(units)}`;
}

// One entry per tick, from 0 to capacity; labelled ticks are major.
export function scaleMarks(syringe: SyringeKey): ScaleMark[] {
  const { capacityUnits, markSpacing, labelEvery } = SYRINGES[syringe];
  const marks: ScaleMark[] = [];
  for (let units = 0; units <= capacityUnits; units += markSpacing) {
    marks.push({ units, y: unitToY(units, syringe), major: units % labelEvery === 0 });
  }
  return marks;
}
