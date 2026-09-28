import { useMemo, useState } from "react";
import { AmountField } from "@/components/AmountField";
import { ModeTabs, type Mode } from "@/components/ModeTabs";
import { SyringePicker } from "@/components/SyringePicker";
import {
  drawForDose,
  isIncompleteAmount,
  parseAmount,
  waterOptions,
  type AmountField as Field,
  type CalcMessage,
  type SyringeKey,
} from "@/lib/calc";

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

  const errors = mode === "mix" ? mix.errors : draw.errors;

  function changeText(field: Field, value: string) {
    setText((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 pt-5 pb-10 sm:pt-10">
      <ModeTabs mode={mode} onModeChange={setMode}>
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
          <SyringePicker value={syringe} onChange={setSyringe} />
        </div>
      </ModeTabs>
      <footer className="mt-10 max-w-[40em] text-sm text-muted-foreground">
        This does arithmetic only. Check your numbers with your prescriber or pharmacist.
      </footer>
    </main>
  );
}
