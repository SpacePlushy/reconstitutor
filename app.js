// Connects the page to calc.js and syringe.js. All math lives in calc.js.
(function () {
  "use strict";

  const Calc = window.Calc;
  const Syringe = window.Syringe;

  const fields = {
    vialMg: document.getElementById("vial"),
    waterMl: document.getElementById("water"),
    doseMg: document.getElementById("dose"),
  };
  const fieldErrors = {
    vialMg: document.getElementById("vial-error"),
    waterMl: document.getElementById("water-error"),
    doseMg: document.getElementById("dose-error"),
  };
  const answer = document.getElementById("answer");
  const optionsSection = document.getElementById("options");
  const mathSection = document.getElementById("math");
  const syringeArt = document.getElementById("syringe-art");

  const PROMPTS = {
    mix: "Enter your vial and dose to see how much water to add.",
    draw: "Enter your vial, water and dose to see where to draw.",
  };
  const STATUS_TEXT = {
    "wont-fit": "Won't fit",
    "hard-to-measure": "Hard to measure",
    "between-marks": "Between marks",
  };

  // The water amount tapped in the table. null means "use the recommendation".
  let selectedWaterMl = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function checkedValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`).value;
  }

  function readValues() {
    return {
      vialMg: Calc.parseAmount(fields.vialMg.value),
      waterMl: Calc.parseAmount(fields.waterMl.value),
      doseMg: Calc.parseAmount(fields.doseMg.value),
      syringe: checkedValue("syringe"),
    };
  }

  // Field errors appear only once something is typed, so an empty form stays calm.
  function showFieldErrors(errors) {
    for (const key of Object.keys(fields)) {
      const error = errors.find((e) => e.field === key);
      const message = error && fields[key].value.trim() !== "" ? error.message : "";
      fieldErrors[key].textContent = message;
      fieldErrors[key].hidden = !message;
      fields[key].setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  // "40 units" -> a big "40" and a smaller "units".
  function bigFigure(verb, text, tail) {
    const line = el("p", "answer-main");
    line.append(el("span", "answer-verb", verb));
    const match = /^([\d.]+) (.+)$/.exec(text);
    if (match) line.append(el("span", "answer-number", match[1]), el("span", "answer-unit", ` ${match[2]}`));
    else line.append(el("span", "answer-unit", text));
    if (tail) line.append(el("span", "answer-tail", tail));
    return line;
  }

  function noticeList(messages) {
    const list = el("ul", "notices");
    for (const message of messages) list.append(el("li", "notice", message));
    return list;
  }

  function showEmpty(mode, errors, syringe) {
    const general = errors.filter((e) => !e.field).map((e) => e.message);
    answer.replaceChildren(general.length ? noticeList(general) : el("p", "answer-empty", PROMPTS[mode]));
    showSyringe(syringe, 0, "empty");
  }

  // Re-render only when the syringe size changes, so the plunger can slide between doses.
  function showSyringe(syringe, units, state) {
    const svg = syringeArt.querySelector("svg");
    if (!svg || svg.dataset.syringe !== syringe) {
      syringeArt.innerHTML = Syringe.renderSyringe({ syringe, units, state });
      return;
    }
    const position = Syringe.syringePosition({ syringe, units, state });
    svg.dataset.state = state;
    svg.setAttribute("aria-label", Syringe.describeSyringe({ syringe, units, state }));
    svg.querySelector(".syr-fill").style.transform = `scaleY(${position.fillScale})`;
    for (const group of svg.querySelectorAll(".syr-moving")) {
      group.style.transform = `translateY(${position.offset}px)`;
    }
    svg.querySelector(".syr-drawlabel").textContent = position.label;
  }

  function optionsTable(rows, selected) {
    const table = el("table", "options-table");
    table.append(el("caption", "visually-hidden", "Water amounts to choose from"));
    const headRow = el("tr");
    for (const title of ["Water", "Strength", "Dose", "1 mg ="]) {
      const th = el("th", null, title);
      th.scope = "col";
      headRow.append(th);
    }
    const head = el("thead");
    head.append(headRow);

    const body = el("tbody");
    for (const row of rows) {
      const tr = el("tr", "option");
      tr.classList.toggle("is-selected", row === selected);
      tr.classList.toggle("is-flagged", row.status !== "ok");

      const radio = el("input");
      radio.type = "radio";
      radio.name = "water";
      radio.value = String(row.waterMl);
      radio.checked = row === selected;
      const label = el("label");
      label.append(radio, Calc.formatWaterMl(row.waterMl));
      const waterCell = el("td", "option-water");
      waterCell.append(label);
      if (row.recommended) waterCell.append(el("span", "option-status is-recommended", "★ Recommended"));
      else if (STATUS_TEXT[row.status]) waterCell.append(el("span", "option-status", STATUS_TEXT[row.status]));

      tr.append(
        waterCell,
        el("td", null, Calc.formatConcentration(row.concentration)),
        el("td", null, Calc.formatUnits(row.units)),
        el("td", null, Calc.formatUnits(row.unitsPerMg)),
      );
      body.append(tr);
    }
    table.append(head, body);
    return table;
  }

  function renderMix(values) {
    const res = Calc.waterOptions(values);
    showFieldErrors(res.errors);
    optionsSection.replaceChildren();
    if (res.errors.length) {
      showEmpty("mix", res.errors, values.syringe);
      return;
    }

    const selected =
      res.rows.find((row) => row.waterMl === selectedWaterMl) ||
      res.rows.find((row) => row.recommended) ||
      res.rows[0];

    answer.replaceChildren(
      bigFigure("Add", Calc.formatWaterMl(selected.waterMl), "of bacteriostatic water"),
      el("p", "answer-detail", `Measure: ${Calc.describeWaterMeasure(selected.waterMl, values.syringe)}`),
      el("p", "answer-detail", `Makes ${Calc.formatConcentration(selected.concentration)}. Your dose: ${Calc.formatUnits(selected.units)}.`),
      el("p", "answer-detail", `${Calc.formatDoses(res.dosesInVial, res.leftoverMg)}.`),
    );
    const messages = res.warnings.map((w) => w.message);
    if (selected.note) messages.push(selected.note);
    if (messages.length) answer.append(noticeList(messages));

    showSyringe(values.syringe, selected.units, selected.status === "wont-fit" ? "overflow" : "ok");
    optionsSection.append(optionsTable(res.rows, selected));
  }

  function renderDraw(values) {
    const res = Calc.drawForDose(values);
    showFieldErrors(res.errors);
    mathSection.replaceChildren();
    if (!res.result) {
      showEmpty("draw", res.errors, values.syringe);
      return;
    }

    const r = res.result;
    answer.replaceChildren(
      bigFigure("Draw to", Calc.formatUnits(r.units)),
      el("p", "answer-detail", `${Calc.formatMl(r.ml)} at ${Calc.formatConcentration(r.concentration)}. ${Calc.formatDoses(r.dosesInVial, r.leftoverMg)}.`),
    );
    if (r.nearestMarkText) answer.append(el("p", "answer-detail", r.nearestMarkText));
    const messages = [...res.errors, ...res.warnings].map((m) => m.message);
    if (messages.length) answer.append(noticeList(messages));

    showSyringe(values.syringe, r.units, r.fits ? "ok" : "overflow");

    const steps = el("ol", "math-steps");
    for (const line of r.workedMath) steps.append(el("li", null, line));
    mathSection.append(el("h2", null, "How this was worked out"), steps);
  }

  function render() {
    const mode = checkedValue("mode");
    for (const node of document.querySelectorAll("[data-mode]")) node.hidden = node.dataset.mode !== mode;
    const values = readValues();
    if (mode === "mix") renderMix(values);
    else renderDraw(values);
  }

  document.addEventListener("input", (event) => {
    if (!event.target.matches(".amount input")) return;
    selectedWaterMl = null;
    render();
  });

  document.addEventListener("change", (event) => {
    const { name } = event.target;
    if (name === "syringe") selectedWaterMl = null;
    if (name === "water") selectedWaterMl = Number(event.target.value);
    if (name === "syringe" || name === "mode" || name === "water") render();
    // The table is rebuilt on render; put focus back so arrow keys keep working.
    if (name === "water") optionsSection.querySelector('input[name="water"]:checked').focus();
  });

  // Tapping anywhere on a row picks it, not just the water amount.
  optionsSection.addEventListener("click", (event) => {
    const row = event.target.closest("tr.option");
    if (!row || event.target.closest("label")) return;
    const radio = row.querySelector('input[name="water"]');
    if (radio.checked) return;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  });

  render();
})();
