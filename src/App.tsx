import { useMemo, useState } from "react";
import { AmountField } from "@/components/AmountField";
import { AnswerCard } from "@/components/AnswerCard";
import { ModeTabs, type Mode } from "@/components/ModeTabs";
import { SyringeDiagram } from "@/components/SyringeDiagram";
import { SyringePicker } from "@/components/SyringePicker";
import { WaterOptionsTable } from "@/components/WaterOptionsTable";
import { WorkedMath } from "@/components/WorkedMath";
import {
  drawForDose,
  isIncompleteAmount,
  parseAmount,
  waterOptions,
  type AmountField as Field,
  type CalcMessage,
  type SyringeKey,
} from "@/lib/calc";
import type { SyringeView } from "@/lib/syringe";

type AmountText = Record<Field, string>;

// Field errors appear only once something invalid is typed, so an empty form
// stays calm and "0." on the way to "0.5" doesn't flash red.
function visibleError(field: Field, text: string, errors: CalcMessage[]): string | undefined {
  const error = errors.find((e) => e.field === field);
  if (!error || text.trim() === "" || isIncompleteAmount(text)) return undefined;
  return error.message;
}

export function App() {
  const [mode, setMode] = useState<Mode>("mix");
  const [text, setText] = useState<AmountText>({ vialMg: "", waterMl: "", doseMg: "" });
  const [syringe, setSyringe] = useState<SyringeKey>("1");
  // The water amount tapped in the table. null means "use the recommendation".
  const [selectedWaterMl, setSelectedWaterMl] = useState<number | null>(null);

  const values = useMemo(
    () => ({
      vialMg: parseAmount(text.vialMg),
      waterMl: parseAmount(text.waterMl),
      doseMg: parseAmount(text.doseMg),
      syringe,
    }),
    [text, syringe],
  );
  const mix = useMemo(() => waterOptions(values), [values]);
  const draw = useMemo(() => drawForDose(values), [values]);

  const selected =
    mix.rows.find((row) => row.waterMl === selectedWaterMl) ??
    mix.rows.find((row) => row.recommended) ??
    mix.rows[0] ??
    null;

  let view: SyringeView = { syringe, units: 0, state: "empty" };
  if (mode === "mix" && selected) {
    view = {
      syringe,
      units: selected.units,
      state: selected.status === "wont-fit" ? "overflow" : "ok",
    };
  } else if (mode === "draw" && draw.result) {
    view = { syringe, units: draw.result.units, state: draw.result.fits ? "ok" : "overflow" };
  }

  const errors = mode === "mix" ? mix.errors : draw.errors;

  function changeText(field: Field, value: string) {
    setText((previous) => ({ ...previous, [field]: value }));
    setSelectedWaterMl(null);
  }

  function changeSyringe(next: SyringeKey) {
    setSyringe(next);
    setSelectedWaterMl(null);
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-5 pb-10 sm:pt-10">
      <ModeTabs mode={mode} onModeChange={setMode}>
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-10">
          <div className="flex min-w-0 flex-col gap-5">
            <AmountField
              id="vial"
              label="Vial"
              unit="mg"
              value={text.vialMg}
              error={visibleError("vialMg", text.vialMg, errors)}
              onChange={(value) => {
                changeText("vialMg", value);
              }}
            />
            {mode === "draw" && (
              <AmountField
                id="water"
                label="Water added"
                unit="mL"
                value={text.waterMl}
                error={visibleError("waterMl", text.waterMl, errors)}
                onChange={(value) => {
                  changeText("waterMl", value);
                }}
              />
            )}
            <AmountField
              id="dose"
              label="Your dose"
              unit="mg"
              value={text.doseMg}
              error={visibleError("doseMg", text.doseMg, errors)}
              onChange={(value) => {
                changeText("doseMg", value);
              }}
            />
            <SyringePicker value={syringe} onChange={changeSyringe} />
            {mode === "mix" ? (
              <AnswerCard mode="mix" response={mix} selected={selected} syringe={syringe} />
            ) : (
              <AnswerCard mode="draw" response={draw} />
            )}
          </div>
          <SyringeDiagram {...view} />
        </div>
        {mode === "mix" ? (
          <WaterOptionsTable
            rows={mix.rows}
            selectedWaterMl={selected?.waterMl ?? null}
            onSelect={setSelectedWaterMl}
          />
        ) : (
          draw.result && <WorkedMath lines={draw.result.workedMath} />
        )}
      </ModeTabs>
      <footer className="mt-10 max-w-[40em] text-sm text-muted-foreground">
        This does arithmetic only. Check your numbers with your prescriber or pharmacist.
      </footer>
    </main>
  );
}
