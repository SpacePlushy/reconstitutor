// Draws the upright U-100 syringe as an SVG string. No DOM access.
(function () {
  "use strict";

  const Calc = typeof module !== "undefined" && module.exports ? require("./calc.js") : window.Calc;

  // Geometry in SVG user units. The needle points up; 0 units is the top of the barrel.
  const VIEW_WIDTH = 124;
  const VIEW_HEIGHT = 580;
  const CENTER_X = 60;
  const BARREL_LEFT = 42;
  const BARREL_RIGHT = 78;
  const BARREL_TOP = 80;
  const SCALE_TOP = 82;
  const SCALE_LENGTH = 420;
  const BARREL_BOTTOM = SCALE_TOP + SCALE_LENGTH + 24;
  const STOPPER_HEIGHT = 14;
  const THUMB_TOP = VIEW_HEIGHT - 14;

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  function unitToY(units, syringe) {
    const capacity = Calc.SYRINGES[syringe].capacityUnits;
    const clamped = Math.min(Math.max(units, 0), capacity);
    return round3(SCALE_TOP + (clamped / capacity) * SCALE_LENGTH);
  }

  // Where the moving parts sit. Overflow parks the stopper at capacity.
  function syringePosition({ syringe, units, state }) {
    const capacity = Calc.SYRINGES[syringe].capacityUnits;
    const drawn = state === "empty" ? 0 : state === "overflow" ? capacity : units;
    const offset = round3(unitToY(drawn, syringe) - SCALE_TOP);
    return {
      fillScale: round3(offset / SCALE_LENGTH),
      offset,
      label: state === "ok" ? Calc.formatUnitsNumber(units) : "",
    };
  }

  function describeSyringe({ syringe, units, state }) {
    const { label } = Calc.SYRINGES[syringe];
    if (state === "empty") return `${label} syringe, empty`;
    if (state === "overflow") return `${label} syringe, dose doesn't fit`;
    return `${label} syringe drawn to ${Calc.formatUnits(units)}`;
  }

  function scaleMarkup(syringe) {
    const { capacityUnits, markSpacing, labelEvery } = Calc.SYRINGES[syringe];
    let markup = "";
    for (let units = 0; units <= capacityUnits; units += markSpacing) {
      const y = unitToY(units, syringe);
      const major = units % labelEvery === 0;
      const x1 = BARREL_RIGHT - (major ? 16 : 8);
      markup += `<line class="syr-tick${major ? " syr-tick-major" : ""}" x1="${x1}" y1="${y}" x2="${BARREL_RIGHT}" y2="${y}"/>`;
      if (major) markup += `<text class="syr-label" x="${BARREL_RIGHT + 6}" y="${y}" dy="0.35em">${units}</text>`;
    }
    return markup;
  }

  function renderSyringe({ syringe, units, state }) {
    const position = syringePosition({ syringe, units, state });
    const innerLeft = BARREL_LEFT + 1.5;
    const innerWidth = BARREL_RIGHT - BARREL_LEFT - 3;
    const scaleBottom = SCALE_TOP + SCALE_LENGTH;
    const moving = `style="transform: translateY(${position.offset}px)"`;
    return (
      `<svg class="syr" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" preserveAspectRatio="xMidYMin meet" role="img"` +
      ` aria-label="${describeSyringe({ syringe, units, state })}" data-syringe="${syringe}" data-state="${state}">` +
      `<line class="syr-needle" x1="${CENTER_X}" y1="6" x2="${CENTER_X}" y2="60"/>` +
      `<rect class="syr-hub" x="${CENTER_X - 7}" y="58" width="14" height="${BARREL_TOP - 58}" rx="2"/>` +
      `<rect class="syr-barrel" x="${BARREL_LEFT}" y="${BARREL_TOP}" width="${BARREL_RIGHT - BARREL_LEFT}" height="${BARREL_BOTTOM - BARREL_TOP}" rx="3"/>` +
      // The rod runs the full length behind the liquid; the opaque fill hides the part above the stopper.
      `<rect class="syr-rod" x="${CENTER_X - 3}" y="${SCALE_TOP}" width="6" height="${THUMB_TOP - SCALE_TOP}"/>` +
      `<rect class="syr-fill" x="${innerLeft}" y="${SCALE_TOP}" width="${innerWidth}" height="${SCALE_LENGTH}" style="transform: scaleY(${position.fillScale})"/>` +
      `<g class="syr-moving syr-plunger" ${moving}>` +
      `<rect class="syr-stopper" x="${innerLeft}" y="${SCALE_TOP}" width="${innerWidth}" height="${STOPPER_HEIGHT}" rx="2"/>` +
      `</g>` +
      scaleMarkup(syringe) +
      `<line class="syr-overflow" x1="${BARREL_LEFT - 6}" y1="${scaleBottom}" x2="${BARREL_RIGHT}" y2="${scaleBottom}"/>` +
      `<g class="syr-moving syr-draw" ${moving}>` +
      `<line class="syr-drawline" x1="${BARREL_LEFT - 6}" y1="${SCALE_TOP}" x2="${BARREL_RIGHT}" y2="${SCALE_TOP}"/>` +
      `<text class="syr-drawlabel" x="${BARREL_LEFT - 10}" y="${SCALE_TOP}" dy="0.35em">${position.label}</text>` +
      `</g>` +
      `<rect class="syr-flange" x="${BARREL_LEFT - 14}" y="${BARREL_BOTTOM}" width="${BARREL_RIGHT - BARREL_LEFT + 28}" height="8" rx="2"/>` +
      `<rect class="syr-thumb" x="${CENTER_X - 16}" y="${THUMB_TOP}" width="32" height="8" rx="2"/>` +
      `</svg>`
    );
  }

  const api = { unitToY, syringePosition, describeSyringe, renderSyringe };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.Syringe = api;
})();
