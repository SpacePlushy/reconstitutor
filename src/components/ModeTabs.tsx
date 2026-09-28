import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type Mode = "mix" | "draw";

function isMode(value: string): value is Mode {
  return value === "mix" || value === "draw";
}

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  children: ReactNode;
}

// The masthead and the mode switch. Both modes share one panel; all values live in App.
export function ModeTabs({ mode, onModeChange, children }: ModeTabsProps) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (isMode(value)) onModeChange(value);
      }}
      className="gap-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <h1 className="text-lg font-bold sm:text-xl">Retatrutide</h1>
        <TabsList variant="line" className="h-auto gap-5 p-0">
          <TabsTrigger
            value="mix"
            className="flex-none px-0 py-1 text-base font-semibold text-muted-foreground data-active:text-foreground"
          >
            Mix a vial
          </TabsTrigger>
          <TabsTrigger
            value="draw"
            className="flex-none px-0 py-1 text-base font-semibold text-muted-foreground data-active:text-foreground"
          >
            Draw a dose
          </TabsTrigger>
        </TabsList>
      </header>
      {/* The panel starts with the Vial field, so it needs no tab stop of its own;
          Radix's default one would be an invisible stop between the tabs and the field. */}
      <TabsContent value={mode} tabIndex={-1} className="text-base">
        {children}
      </TabsContent>
    </Tabs>
  );
}
