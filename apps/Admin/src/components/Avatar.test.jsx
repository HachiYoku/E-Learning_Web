import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";
import { avatarInitial } from "./avatarUtils";

describe("Admin Avatar", () => {
  it("renders a real uploaded avatar", () => {
    render(<Avatar src="https://images.example.test/student.jpg" name="Nok" alt="Nok" className="avatar" />);
    expect(screen.getByRole("img", { name: "Nok" }).getAttribute("src")).toBe("https://images.example.test/student.jpg");
  });

  it("renders a local initial or neutral icon without a remote URL", () => {
    render(<><Avatar name="Nok" alt="Nok" fallbackClassName="avatar" /><Avatar name="" alt="Unknown" fallbackClassName="avatar" /></>);
    expect(screen.getByLabelText("Nok").textContent).toBe("N");
    expect(screen.getByLabelText("Unknown").querySelector("svg")).toBeTruthy();
    expect(avatarInitial("  nok")).toBe("N");
  });
});
