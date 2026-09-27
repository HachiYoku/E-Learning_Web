import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyProfile from "./MyProfile";

const deleteAccount = vi.fn();
const confirmAccountDeletion = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "student-1", name: "Mali", email: "mali@example.test" }, setUser: vi.fn(), confirmAccountDeletion, deleteAccount }),
}));
vi.mock("../services/authService", () => ({ updateProfile: vi.fn() }));

async function scheduleDeletion() {
  fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
  const dialog = screen.getByRole("dialog", { name: /delete your account/i });
  fireEvent.change(within(dialog).getByLabelText(/current password/i), { target: { value: "CorrectHorseBattery1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /^delete account$/i }));
  await act(async () => {});
}

describe("MyProfile account deletion", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("schedules deletion without sending a request, then supports Undo", async () => {
    confirmAccountDeletion.mockResolvedValue("deletion-confirmation-token-1234567890");
    render(<MemoryRouter><MyProfile /></MemoryRouter>);
    await scheduleDeletion();

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/account deletion scheduled/i)).toBeTruthy();
    expect(screen.getByText(/5 seconds/i)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(deleteAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByText(/account deletion scheduled/i)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("calls the existing deletion action exactly once after five seconds", async () => {
    confirmAccountDeletion.mockResolvedValue("deletion-confirmation-token-1234567890");
    deleteAccount.mockResolvedValue({});
    render(<MemoryRouter><MyProfile /></MemoryRouter>);
    await scheduleDeletion();
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(deleteAccount).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(confirmAccountDeletion).toHaveBeenCalledWith("CorrectHorseBattery1");
    expect(deleteAccount).toHaveBeenCalledWith("deletion-confirmation-token-1234567890");
    expect(screen.getByText(/deleting account/i)).toBeTruthy();
  });

  it("does not create duplicate timers or requests from repeated confirmation clicks", async () => {
    confirmAccountDeletion.mockResolvedValue("deletion-confirmation-token-1234567890");
    deleteAccount.mockResolvedValue({});
    render(<MemoryRouter><MyProfile /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete your account/i });
    fireEvent.change(within(dialog).getByLabelText(/current password/i), { target: { value: "CorrectHorseBattery1" } });
    const confirm = within(dialog).getByRole("button", { name: /^delete account$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("does not leave a deletion timer behind after unmount", async () => {
    confirmAccountDeletion.mockResolvedValue("deletion-confirmation-token-1234567890");
    deleteAccount.mockResolvedValue({});
    const view = render(<MemoryRouter><MyProfile /></MemoryRouter>);
    await scheduleDeletion();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("shows a wrong-password error without beginning a countdown or attempting deletion", async () => {
    confirmAccountDeletion.mockRejectedValue(new Error("Current password is incorrect."));
    render(<MemoryRouter><MyProfile /></MemoryRouter>);
    await scheduleDeletion();
    const dialog = screen.getByRole("dialog", { name: /delete your account/i });
    expect(within(dialog).getByRole("alert").textContent).toContain("Current password is incorrect.");
    expect(screen.queryByText(/account deletion scheduled/i)).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: /your profile/i })).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
