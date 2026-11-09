import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudentMore from "./StudentMore";

const logout = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Mali", email: "mali@example.test" }, logout }),
}));

function renderMore() {
  return render(<MemoryRouter initialEntries={["/app/more"]}><Routes>
    <Route path="/app/more" element={<StudentMore />} />
    <Route path="/" element={<p>Home page</p>} />
  </Routes></MemoryRouter>);
}

describe("StudentMore logout", () => {
  beforeEach(() => { logout.mockReset(); });

  it("places Log out below Share feedback and opens the shared confirmation modal", () => {
    renderMore();
    const feedback = screen.getByRole("link", { name: /share feedback/i });
    const logOut = screen.getByRole("button", { name: /log out/i });
    expect(feedback.compareDocumentPosition(logOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logOut.textContent).toBe("Log out");

    fireEvent.click(logOut);
    expect(screen.getByRole("dialog", { name: /sign out for now/i })).toBeTruthy();
  });

  it("cancels without logging out or navigating", () => {
    renderMore();
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /sign out for now/i })).getByRole("button", { name: /^cancel$/i }));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByText("Home page")).toBeNull();
  });

  it("logs out once and redirects home even when confirmation is tapped repeatedly", async () => {
    let resolveLogout;
    logout.mockImplementation(() => new Promise((resolve) => { resolveLogout = resolve; }));
    renderMore();
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    const confirm = within(screen.getByRole("dialog", { name: /sign out for now/i })).getByRole("button", { name: /^log out$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(logout).toHaveBeenCalledTimes(1);

    await act(async () => resolveLogout());
    expect(await screen.findByText("Home page")).toBeTruthy();
  });
});
