import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";

vi.mock("../services/authService", () => ({ forgotPassword: vi.fn() }));
vi.mock("../components/AuthShell", () => ({ default: ({ children }) => <main>{children}</main> }));

let widgetCallbacks;
let turnstile;

function renderForgotPassword() {
  return render(<MemoryRouter initialEntries={["/forgot-password"]}><Routes>
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/login" element={<p>Login page</p>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-public-site-key");
  widgetCallbacks = null;
  turnstile = {
    render: vi.fn((_container, callbacks) => { widgetCallbacks = callbacks; return "widget-1"; }),
    reset: vi.fn(), remove: vi.fn(),
  };
  window.turnstile = turnstile;
  vi.mocked(forgotPasswordRequest).mockReset();
});

afterEach(() => {
  cleanup();
  document.getElementById("registration-turnstile-script")?.remove();
  delete window.turnstile;
  vi.unstubAllEnvs();
});

describe("forgot-password Turnstile", () => {
  it("blocks submission until a password-reset token exists and sends it with the email", async () => {
    vi.mocked(forgotPasswordRequest).mockResolvedValue({ message: "If that email exists, a password reset link has been sent" });
    renderForgotPassword();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.test" } });
    expect(screen.getByRole("button", { name: "Send reset link" }).disabled).toBe(true);
    expect(widgetCallbacks.action).toBe("forgot_password");
    act(() => widgetCallbacks.callback("fresh-token"));
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(forgotPasswordRequest).toHaveBeenCalledWith({ email: "student@example.test", turnstileToken: "fresh-token" }));
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
  });

  it("clears an expired or server-rejected token before allowing a retry", async () => {
    vi.mocked(forgotPasswordRequest).mockRejectedValueOnce(new Error("Security verification failed or expired. Please try again."));
    renderForgotPassword();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.test" } });
    act(() => widgetCallbacks.callback("expired-token"));
    act(() => widgetCallbacks["expired-callback"]());
    expect(screen.getByRole("button", { name: "Send reset link" }).disabled).toBe(true);
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
    act(() => widgetCallbacks.callback("rejected-token"));
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(screen.getByText("Security verification failed or expired. Please try again.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Send reset link" }).disabled).toBe(true);
    expect(screen.getByLabelText("Email address").value).toBe("student@example.test");
  });

  it("fails closed when the public site key is not configured", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    renderForgotPassword();
    expect(screen.getByText("Security verification is unavailable. Please try again later.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send reset link" }).disabled).toBe(true);
  });
});
