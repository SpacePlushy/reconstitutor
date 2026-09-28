// A non-breaking space keeps "20 units" from wrapping into "20" / "units".
export function glueUnits(text: string): string {
  return text.replace(/(\d) (units?|mg\/mL|mL|mg)(?![\w/])/g, "$1\u00a0$2");
}

// "40 units" -> { number: "40", unit: "units" }, so the answer can size them apart.
// null when the text doesn't start with a number, such as "less than 0.1 units".
export function splitFigure(text: string): { number: string; unit: string } | null {
  const match = /^([\d.]+) (.+)$/.exec(text);
  if (!match?.[1] || !match[2]) return null;
  return { number: match[1], unit: match[2] };
}
