import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Register from "./Register";
import { register as registerRequest } from "../services/authService";

vi.mock("../services/authService", () => ({ register: vi.fn() }));
vi.mock("../components/AuthShell", () => ({ default: ({ children }) => <main>{children}</main> }));

let widgetCallbacks;
let turnstile;

function renderRegister() {
  return render(<MemoryRouter initialEntries={["/register"]}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/login" element={<p>Login page</p>} />
  </Routes></MemoryRouter>);
}

function completeForm() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Student" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.test" } });
  fireEvent.change(screen.getByPlaceholderText("Create a secure password"), { target: { value: "CorrectHorseBattery1" } });
  fireEvent.click(screen.getByLabelText("I am 18 or older"));
}

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-public-site-key");
  widgetCallbacks = null;
  turnstile = {
    render: vi.fn((_container, callbacks) => { widgetCallbacks = callbacks; return "widget-1"; }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = turnstile;
  vi.mocked(registerRequest).mockReset();
});

afterEach(() => {
  cleanup();
  document.getElementById("registration-turnstile-script")?.remove();
  delete window.turnstile;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("student registration Turnstile", () => {
  it("blocks submission until a token exists and sends it with the existing registration fields", async () => {
    vi.mocked(registerRequest).mockResolvedValue({ message: "Check email", emailSent: true });
    renderRegister();
    completeForm();
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(true);
    expect(registerRequest).not.toHaveBeenCalled();
    expect(widgetCallbacks.action).toBe("register");
    act(() => widgetCallbacks.callback("fresh-token"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(registerRequest).toHaveBeenCalledWith({
      name: "Student", email: "student@example.test", password: "CorrectHorseBattery1",
      ageGroup: "18_plus", ageConfirmed: true, guardianPermission: false, turnstileToken: "fresh-token",
    }));
    expect(await screen.findByText("Login page")).toBeTruthy();
  });

  it("clears expired tokens and independently resets after server rejection", async () => {
    vi.mocked(registerRequest).mockRejectedValueOnce(new Error("Security verification failed or expired. Please try again."));
    renderRegister();
    completeForm();
    act(() => widgetCallbacks.callback("old-token"));
    act(() => widgetCallbacks["expired-callback"]());
    expect(screen.getByText("Security verification expired. Please try again.")).toBeTruthy();
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(true);
    turnstile.reset.mockClear();
    act(() => widgetCallbacks.callback("new-token"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(turnstile.reset).toHaveBeenCalledTimes(1));
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(true);
    expect(registerRequest).toHaveBeenCalledTimes(1);
    act(() => widgetCallbacks.callback("retry-token"));
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(false);
  });

  it("uses a compact widget on narrow screens and invalidates the token when sizing changes", () => {
    vi.stubGlobal("innerWidth", 320);
    renderRegister();
    expect(turnstile.render).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ size: "compact", action: "register" }));
    expect(screen.getByRole("group", { name: "Security verification" }).className).toBe("flex flex-col items-center");
    act(() => widgetCallbacks.callback("mobile-token"));
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(false);

    vi.stubGlobal("innerWidth", 375);
    fireEvent.resize(window);
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group", { name: "Security verification" }).className).toBe("flex flex-col items-center");

    vi.stubGlobal("innerWidth", 390);
    fireEvent.resize(window);
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
    expect(turnstile.render).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ size: "normal", action: "register" }));
    expect(screen.getByRole("group", { name: "Security verification" }).className).toBe("");
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(true);

    vi.stubGlobal("innerWidth", 1024);
    fireEvent.resize(window);
    expect(turnstile.render).toHaveBeenCalledTimes(2);
    expect(turnstile.render).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ size: "normal", action: "register" }));
    expect(screen.getByRole("group", { name: "Security verification" }).className).toBe("");
  });

  it("offers an accessible Retry after a widget error", () => {
    renderRegister();
    act(() => widgetCallbacks["error-callback"]());
    expect(screen.getByText("Security verification could not load. Please retry.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry security verification" }));
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
  });

  it("loads one script, renders after load, and removes the widget on unmount", () => {
    delete window.turnstile;
    const first = renderRegister();
    const script = document.getElementById("registration-turnstile-script");
    expect(script?.src).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    expect(document.querySelectorAll("#registration-turnstile-script")).toHaveLength(1);
    window.turnstile = turnstile;
    fireEvent.load(script);
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
    renderRegister();
    expect(document.querySelectorAll("#registration-turnstile-script")).toHaveLength(1);
  });

  it("retries script loading after a network error without adding duplicate scripts", () => {
    delete window.turnstile;
    renderRegister();
    fireEvent.error(document.getElementById("registration-turnstile-script"));
    expect(document.querySelectorAll("#registration-turnstile-script")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry security verification" }));
    expect(document.querySelectorAll("#registration-turnstile-script")).toHaveLength(1);
    window.turnstile = turnstile;
    fireEvent.load(document.getElementById("registration-turnstile-script"));
    expect(turnstile.render).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the public site key is not configured", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    renderRegister();
    expect(screen.getByText("Security verification is unavailable. Please try again later.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" }).disabled).toBe(true);
    expect(turnstile.render).not.toHaveBeenCalled();
  });
});
