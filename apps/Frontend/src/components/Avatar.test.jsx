import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar";
import { getAvatarInitial } from "./avatarUtils";

describe("Avatar", () => {
  it("uses an uploaded avatar when available", () => {
    render(<Avatar src="https://images.example.test/mali.jpg" name="Mali" alt="Mali" className="avatar" />);
    expect(screen.getByRole("img", { name: "Mali" }).getAttribute("src")).toBe("https://images.example.test/mali.jpg");
  });

  it("uses a local name initial or neutral icon without deriving from email", () => {
    render(<><Avatar name="  mali" alt="Mali" fallbackClassName="avatar" /><Avatar name="" alt="Profile" fallbackClassName="avatar" /></>);
    expect(screen.getByLabelText("Mali").textContent).toBe("M");
    expect(screen.getByLabelText("Profile").querySelector("svg")).toBeTruthy();
    expect(getAvatarInitial("  mali")).toBe("M");
    expect(getAvatarInitial("")).toBe("");
  });
});
