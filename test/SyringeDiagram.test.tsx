// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SyringeDiagram } from "@/components/SyringeDiagram";

// The markup checks from the old renderSyringe test, on the React component.
test("SyringeDiagram draws the fill, plunger, draw line and label at the dose", () => {
  const { container } = render(<SyringeDiagram syringe="1" units={20} state="ok" />);
  const svg = screen.getByRole("img", { name: "1 mL syringe drawn to 20 units" });
  expect(svg).toHaveAttribute("data-syringe", "1");
  expect(svg).toHaveAttribute("data-state", "ok");
  expect(container.querySelector(".syr-fill")).toHaveStyle({ transform: "scaleY(0.2)" });
  const moving = Array.from(container.querySelectorAll(".syr-moving"));
  expect(moving).toHaveLength(2);
  for (const group of moving) {
    expect(group).toHaveStyle({ transform: "translateY(84px)" });
  }
  expect(container.querySelector(".syr-drawlabel")).toHaveTextContent("20");
});
