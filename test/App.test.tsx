// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "@/App";
import { glueUnits } from "@/lib/text";

function setup() {
  const user = userEvent.setup();
  render(<App />);
  const answer = () => screen.getByRole("region", { name: "Answer" });
  const syringe = () => screen.getByRole("img");
  // Water amounts are glued to their unit with a non-breaking space, as on the page.
  const waterRadio = (water: string) => screen.getByRole("radio", { name: glueUnits(water) });
  const row = (water: string) => {
    const tr = waterRadio(water).closest("tr");
    if (!tr) throw new Error(`No row for ${water}`);
    return tr;
  };
  const type = async (label: string, text: string) => {
    await user.type(screen.getByLabelText(label), text);
  };
  return { user, answer, syringe, waterRadio, row, type };
}

// --- inputs ----------------------------------------------------------

test("switching tabs keeps the vial and dose", async () => {
  const { user, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(screen.getByLabelText("Water added")).toHaveValue("");
  expect(screen.getByLabelText("Vial")).toHaveValue("10");
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(screen.getByLabelText("Vial")).toHaveValue("10");
  expect(screen.getByLabelText("Your dose")).toHaveValue("2");
});

test("water typed in Draw is still there after a trip to Mix", async () => {
  const { user, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Water added", "2");
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(screen.queryByLabelText("Water added")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(screen.getByLabelText("Water added")).toHaveValue("2");
});

test("half-typed numbers stay calm; text that can't be a number shows an error", async () => {
  const { user, type } = setup();
  const vial = screen.getByLabelText("Vial");
  await type("Vial", "0.");
  expect(vial).toHaveAttribute("aria-invalid", "false");
  expect(screen.queryByText("Enter the vial amount in mg.")).not.toBeInTheDocument();
  await user.clear(vial);
  await type("Vial", "abc");
  expect(vial).toHaveAttribute("aria-invalid", "true");
  expect(vial).toHaveAccessibleDescription("Enter the vial amount in mg.");
});

test("pressing the chosen syringe again keeps it chosen", async () => {
  const { user } = setup();
  const oneMl = screen.getByRole("radio", { name: "1 mL" });
  expect(oneMl).toHaveAttribute("aria-checked", "true");
  await user.click(oneMl);
  expect(oneMl).toHaveAttribute("aria-checked", "true");
});

// --- answer and syringe ----------------------------------------------

test("mix: 10 mg vial, 2 mg dose on a 1 mL syringe answers 1.0 mL", async () => {
  const { answer, syringe, type } = setup();
  expect(answer()).toHaveTextContent("Enter your vial and dose to see how much water to add.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe, empty");
  await type("Vial", "10");
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Add 1.0 mL of bacteriostatic water");
  expect(answer()).toHaveTextContent("Measure: 1 full syringe");
  expect(answer()).toHaveTextContent("Makes 10 mg/mL. Your dose: 20 units.");
  expect(answer()).toHaveTextContent("5 doses in the vial.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe drawn to 20 units");
  expect(syringe()).toHaveAttribute("data-state", "ok");
});

test("draw: a dose that won't fit shows the message and the overflow state", async () => {
  const { user, answer, syringe, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  expect(answer()).toHaveTextContent("Enter your vial, water and dose to see where to draw.");
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Draw to 40 units");
  expect(answer()).toHaveTextContent("0.40 mL at 5 mg/mL. 5 doses in the vial.");
  expect(syringe()).toHaveAccessibleName("1 mL syringe drawn to 40 units");

  await user.click(screen.getByRole("radio", { name: "0.3 mL" }));
  expect(answer()).toHaveTextContent(
    "40 units won't fit in a 0.3 mL (30-unit) syringe. Use a 0.5 mL or 1 mL syringe, or split it into 2 draws.",
  );
  expect(syringe()).toHaveAttribute("data-state", "overflow");
  expect(syringe()).toHaveAccessibleName("0.3 mL syringe, dose doesn't fit");
});

test("draw: a dose bigger than the vial shows a general error and an empty syringe", async () => {
  const { user, answer, syringe, type } = setup();
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "12");
  expect(answer()).toHaveTextContent("Your dose is more than the whole vial (10 mg).");
  expect(syringe()).toHaveAttribute("data-state", "empty");
});

test("the syringe keeps its drawing while the dose changes, and redraws for a new size", async () => {
  const { user, syringe, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  const drawing = syringe();
  expect(drawing).toHaveAccessibleName("1 mL syringe drawn to 20 units");
  await user.clear(screen.getByLabelText("Your dose"));
  await type("Your dose", "3");
  expect(syringe()).toBe(drawing);
  expect(drawing).toHaveAccessibleName("1 mL syringe drawn to 30 units");
  await user.click(screen.getByRole("radio", { name: "0.5 mL" }));
  expect(syringe()).not.toBe(drawing);
});

// --- water options and worked math -----------------------------------

test("mix: the recommended row starts selected", async () => {
  const { waterRadio, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  expect(waterRadio("1.0 mL")).toBeChecked();
  expect(within(row("1.0 mL")).getByText("Recommended")).toBeInTheDocument();
});

test("mix: tapping anywhere on a row selects it", async () => {
  const { user, answer, waterRadio, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(within(row("2.0 mL")).getByText("40 units"));
  expect(waterRadio("2.0 mL")).toBeChecked();
  expect(waterRadio("2.0 mL")).toHaveFocus();
  expect(answer()).toHaveTextContent("Add 2.0 mL of bacteriostatic water");
  expect(answer()).toHaveTextContent("Your dose: 40 units.");
});

test("mix: arrow keys move the chosen row and the answer follows", async () => {
  const { user, answer, waterRadio, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  waterRadio("1.0 mL").focus();
  await user.keyboard("{ArrowDown}");
  expect(waterRadio("1.5 mL")).toBeChecked();
  expect(answer()).toHaveTextContent("Add 1.5 mL of bacteriostatic water");
});

test("mix: editing the dose or changing syringe goes back to the recommendation", async () => {
  const { user, answer, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(row("2.0 mL"));
  expect(answer()).toHaveTextContent("Add 2.0 mL");

  await user.clear(screen.getByLabelText("Your dose"));
  await type("Your dose", "2");
  expect(answer()).toHaveTextContent("Add 1.0 mL");

  await user.click(row("2.0 mL"));
  expect(answer()).toHaveTextContent("Add 2.0 mL");
  await user.click(screen.getByRole("radio", { name: "0.5 mL" }));
  expect(screen.getByRole("radio", { name: "0.5 mL" })).toHaveAttribute("aria-checked", "true");
  expect(answer()).toHaveTextContent("Add 1.0 mL");
});

test("switching tabs keeps the chosen row", async () => {
  const { user, answer, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(row("2.0 mL"));
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await user.click(screen.getByRole("tab", { name: "Mix a vial" }));
  expect(answer()).toHaveTextContent("Add 2.0 mL");
});

test("mix: a row that won't fit explains why and shows the overflow", async () => {
  const { user, answer, syringe, row, type } = setup();
  await type("Vial", "10");
  await type("Your dose", "2");
  await user.click(screen.getByRole("radio", { name: "0.3 mL" }));
  await user.click(row("2.0 mL"));
  expect(within(row("2.0 mL")).getByText("Won't fit")).toBeInTheDocument();
  expect(answer()).toHaveTextContent(
    "At 2.0 mL, your dose is 40 units, more than a 0.3 mL syringe holds.",
  );
  expect(syringe()).toHaveAttribute("data-state", "overflow");
});

test("draw: the worked math appears only once there is an answer", async () => {
  const { user, type } = setup();
  const heading = () => screen.queryByRole("heading", { name: "How this was worked out" });
  await user.click(screen.getByRole("tab", { name: "Draw a dose" }));
  await type("Vial", "10");
  await type("Water added", "2");
  await type("Your dose", "2");
  expect(heading()).toBeInTheDocument();
  expect(screen.getByText("0.40 mL × 100 = 40 units")).toBeInTheDocument();
  await type("Your dose", "0");
  expect(heading()).not.toBeInTheDocument();
});
