import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const { clearToken, confirmOwnAccountDeletion, deleteOwnAccount, getCurrentUser } = vi.hoisted(() => ({
  clearToken: vi.fn(),
  confirmOwnAccountDeletion: vi.fn(),
  deleteOwnAccount: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("../api/tokenStorage", () => ({
  clearToken,
  getToken: () => "existing-access-token",
  setToken: vi.fn(),
}));
vi.mock("../api/client", () => ({
  refreshAccessToken: vi.fn(),
  SESSION_EXPIRED_EVENT: "user-session-expired",
}));
vi.mock("../services/authService", () => ({
  deleteOwnAccount,
  confirmOwnAccountDeletion,
  getCurrentUser,
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../components/SessionExpiredModal", () => ({ default: () => null }));

function AuthProbe() {
  const { deleteAccount, user } = useAuth();
  const location = useLocation();
  return <><p>{user?.id || "signed-out"}</p><p>{location.pathname}</p><button type="button" onClick={() => deleteAccount("CorrectHorseBattery1").catch(() => {})}>Delete</button></>;
}

function renderAuth() {
  return render(<MemoryRouter initialEntries={["/app/profile"]}><AuthProvider><AuthProbe /></AuthProvider></MemoryRouter>);
}

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] || null,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe("AuthContext self deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentUser.mockResolvedValue({ user: { id: "student-1", name: "Mali" } });
    vi.stubGlobal("localStorage", createStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("clears only the deleted student's session data and redirects after a successful deletion", async () => {
    deleteOwnAccount.mockResolvedValue({});
    localStorage.setItem("quiz-draft:student-1:course:lesson:quiz", "draft");
    localStorage.setItem("quiz-draft:other-student:course:lesson:quiz", "other draft");
    renderAuth();
    await screen.findByText("student-1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
    expect(deleteOwnAccount).toHaveBeenCalledWith("CorrectHorseBattery1");
    expect(clearToken).toHaveBeenCalled();
    expect(localStorage.getItem("quiz-draft:student-1:course:lesson:quiz")).toBeNull();
    expect(localStorage.getItem("quiz-draft:other-student:course:lesson:quiz")).toBe("other draft");
    await waitFor(() => expect(screen.getByText("/")).toBeTruthy());
  });

  it("keeps the authenticated state and route when the deletion request fails", async () => {
    deleteOwnAccount.mockRejectedValue(new Error("Unable to delete your account."));
    renderAuth();
    await screen.findByText("student-1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteOwnAccount).toHaveBeenCalled());
    expect(screen.getByText("student-1")).toBeTruthy();
    expect(screen.getByText("/app/profile")).toBeTruthy();
    expect(clearToken).not.toHaveBeenCalled();
  });
});
