import { glueUnits } from "@/lib/text";

export function WorkedMath({ lines }: { lines: string[] }) {
  return (
    <section aria-labelledby="math-heading" className="mt-10 border-t pt-4">
      <h2 id="math-heading" className="mb-2 font-semibold">
        How this was worked out
      </h2>
      <ol className="grid gap-1 font-mono text-sm sm:text-base">
        {lines.map((line) => (
          <li key={line}>{glueUnits(line)}</li>
        ))}
      </ol>
    </section>
  );
}
