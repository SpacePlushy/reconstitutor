import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AmountFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

// A number set like an instrument readout on an underline, with its unit beside it.
export function AmountField({ id, label, unit, value, error, onChange }: AmountFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-base leading-normal font-semibold">
        {label}
      </Label>
      <div className="flex max-w-[10em] items-baseline border-b-2 border-foreground focus-within:shadow-[0_2px_0_0_var(--color-foreground)] has-[input[aria-invalid=true]]:border-destructive">
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-auto rounded-none border-0 bg-transparent px-0 py-1 font-mono text-xl font-semibold shadow-none focus-visible:ring-0 aria-invalid:ring-0 md:text-xl dark:bg-transparent"
        />
        <span className="pl-1.5 text-muted-foreground">{unit}</span>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
