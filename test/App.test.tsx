// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
