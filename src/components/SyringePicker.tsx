import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SYRINGE_ORDER, SYRINGES, type SyringeKey } from "@/lib/calc";

function isSyringeKey(value: string): value is SyringeKey {
  return (SYRINGE_ORDER as readonly string[]).includes(value);
}

interface SyringePickerProps {
  value: SyringeKey;
  onChange: (value: SyringeKey) => void;
}

export function SyringePicker({ value, onChange }: SyringePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <span id="syringe-label" className="font-semibold">
        Syringe
      </span>
      <ToggleGroup
        type="single"
        value={value}
        // Radix reports "" when the active item is pressed again; there is always a syringe.
        onValueChange={(next) => {
          if (isSyringeKey(next)) onChange(next);
        }}
        aria-labelledby="syringe-label"
        variant="outline"
        spacing={0}
        className="w-full max-w-[18em]"
      >
        {SYRINGE_ORDER.map((key) => (
          <ToggleGroupItem
            key={key}
            value={key}
            className="h-11 flex-1 border-foreground px-1 text-base font-semibold data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground"
          >
            {SYRINGES[key].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
