import { Notices } from "@/components/Notices";
import {
  describeWaterMeasure,
  formatConcentration,
  formatDoses,
  formatMl,
  formatUnits,
  formatWaterMl,
  type CalcMessage,
  type DrawResponse,
  type SyringeKey,
  type WaterOptionsResponse,
  type WaterRow,
} from "@/lib/calc";
import { glueUnits, splitFigure } from "@/lib/text";

type AnswerCardProps =
  | { mode: "mix"; response: WaterOptionsResponse; selected: WaterRow | null; syringe: SyringeKey }
  | { mode: "draw"; response: DrawResponse };

const PROMPTS = {
  mix: "Enter your vial and dose to see how much water to add.",
  draw: "Enter your vial, water and dose to see where to draw.",
};

// "Add / 1.5 mL / of bacteriostatic water": the number is the readout, sized to be read at arm's length.
function Figure({ verb, text, tail }: { verb: string; text: string; tail?: string }) {
  const figure = splitFigure(text);
  return (
    <p className="mb-3 leading-none">
      <span className="block font-semibold">{verb}</span>{" "}
      {figure ? (
        <span className="font-mono font-semibold">
          <span className="text-answer tracking-tight">{figure.number}</span>
          <span className="text-xl">{`\u00a0${figure.unit}`}</span>
        </span>
      ) : (
        <span className="text-xl font-semibold">{glueUnits(text)}</span>
      )}
      {tail && (
        <>
          {" "}
          <span className="mt-1 block font-semibold">{tail}</span>
        </>
      )}
    </p>
  );
}

function Detail({ text }: { text: string }) {
  return <p className="mt-1">{glueUnits(text)}</p>;
}

// Before there is an answer: general errors if any, otherwise what to type.
function Empty({ prompt, errors }: { prompt: string; errors: CalcMessage[] }) {
  const general = errors.filter((error) => !error.field).map((error) => error.message);
  if (general.length) return <Notices messages={general} />;
  return <p className="text-muted-foreground">{prompt}</p>;
}

function MixAnswer({
  response,
  selected,
  syringe,
}: {
  response: WaterOptionsResponse;
  selected: WaterRow | null;
  syringe: SyringeKey;
}) {
  if (response.errors.length || !selected) {
    return <Empty prompt={PROMPTS.mix} errors={response.errors} />;
  }
  const notices = response.warnings.map((warning) => warning.message);
  if (selected.note) notices.push(selected.note);
  return (
    <>
      <Figure verb="Add" text={formatWaterMl(selected.waterMl)} tail="of bacteriostatic water" />
      <Detail text={`Measure: ${describeWaterMeasure(selected.waterMl, syringe)}`} />
      <Detail
        text={`Makes ${formatConcentration(selected.concentration)}. Your dose: ${formatUnits(selected.units)}.`}
      />
      <Detail text={`${formatDoses(response.dosesInVial, response.leftoverMg)}.`} />
      <Notices messages={notices} />
    </>
  );
}

function DrawAnswer({ response }: { response: DrawResponse }) {
  const result = response.result;
  if (!result) return <Empty prompt={PROMPTS.draw} errors={response.errors} />;
  const notices = [...response.errors, ...response.warnings].map((message) => message.message);
  return (
    <>
      <Figure verb="Draw to" text={formatUnits(result.units)} />
      <Detail
        text={`${formatMl(result.ml)} at ${formatConcentration(result.concentration)}. ${formatDoses(result.dosesInVial, result.leftoverMg)}.`}
      />
      {result.nearestMarkText && <Detail text={result.nearestMarkText} />}
      <Notices messages={notices} />
    </>
  );
}

export function AnswerCard(props: AnswerCardProps) {
  return (
    <section aria-label="Answer" aria-live="polite" className="border-t border-foreground pt-4">
      {props.mode === "mix" ? (
        <MixAnswer response={props.response} selected={props.selected} syringe={props.syringe} />
      ) : (
        <DrawAnswer response={props.response} />
      )}
    </section>
  );
}
