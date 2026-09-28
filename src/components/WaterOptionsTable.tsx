import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatConcentration,
  formatUnits,
  formatWaterMl,
  type RowStatus,
  type WaterRow,
} from "@/lib/calc";
import { glueUnits } from "@/lib/text";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Partial<Record<RowStatus, string>> = {
  "wont-fit": "Won't fit",
  "hard-to-measure": "Hard to measure",
  "between-marks": "Between marks",
};

interface WaterOptionsTableProps {
  rows: WaterRow[];
  selectedWaterMl: number | null;
  onSelect: (waterMl: number) => void;
}

// Each row is a radio, so arrow keys move the choice; tapping anywhere on a row picks it too.
export function WaterOptionsTable({ rows, selectedWaterMl, onSelect }: WaterOptionsTableProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Water amounts" className="mt-10">
      <Table className="text-base">
        <TableCaption className="sr-only">Water amounts to choose from</TableCaption>
        <TableHeader>
          <TableRow className="border-foreground hover:bg-transparent">
            <TableHead
              scope="col"
              className="h-auto pb-2 pl-3 text-sm font-semibold text-muted-foreground"
            >
              Water
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground narrow:hidden"
            >
              Strength
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground"
            >
              Dose
            </TableHead>
            <TableHead
              scope="col"
              className="h-auto pb-2 text-right text-sm font-semibold text-muted-foreground"
            >
              1 mg =
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const selected = row.waterMl === selectedWaterMl;
            const status = STATUS_TEXT[row.status];
            return (
              <TableRow
                key={row.waterMl}
                data-state={selected ? "selected" : undefined}
                onClick={(event) => {
                  onSelect(row.waterMl);
                  // Like tapping the label: focus the radio so arrow keys work next.
                  event.currentTarget.querySelector<HTMLInputElement>("input[name=water]")?.focus();
                }}
                className={cn(
                  "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-ring",
                  "data-[state=selected]:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-draw)]",
                  row.status !== "ok" && "[&>td:not(:first-child)]:text-muted-foreground",
                )}
              >
                <TableCell className="py-2.5 pl-3 align-top">
                  <label className="block cursor-pointer font-mono font-semibold">
                    <input
                      type="radio"
                      name="water"
                      value={row.waterMl}
                      checked={selected}
                      onChange={() => {
                        onSelect(row.waterMl);
                      }}
                      className="sr-only"
                    />
                    {glueUnits(formatWaterMl(row.waterMl))}
                  </label>
                  {row.recommended ? (
                    <span className="block text-sm font-semibold">
                      <span aria-hidden="true" className="text-draw">
                        ★
                      </span>{" "}
                      Recommended
                    </span>
                  ) : (
                    status && <span className="block text-sm text-muted-foreground">{status}</span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono narrow:hidden">
                  {glueUnits(formatConcentration(row.concentration))}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono">
                  {glueUnits(formatUnits(row.units))}
                </TableCell>
                <TableCell className="py-2.5 text-right align-top font-mono">
                  {glueUnits(formatUnits(row.unitsPerMg))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
