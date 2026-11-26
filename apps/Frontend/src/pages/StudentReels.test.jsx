import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentReels from "./StudentReels";
import StudentLayout from "../layouts/StudentLayout";
import RequireAuth from "../routes/RequireAuth";
import { fetchReels } from "../services/reelService";

const auth = vi.hoisted(() => ({ isAuthenticated: true, isBootstrapping: false, user: { name: "Student", role: "user" }, logout: vi.fn() }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../contexts/NotificationContext", () => ({ useNotification: () => ({ unreadCount: 0 }) }));
vi.mock("../components/Seo", () => ({ default: () => null }));
vi.mock("../services/reelService", async (importOriginal) => ({ ...(await importOriginal()), fetchReels: vi.fn() }));

const items = [
  { _id: "one", platform: "youtube", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY" },
  { _id: "two", platform: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk" },
];
let callback;
let observer;
beforeEach(() => {
  auth.isAuthenticated = true;
  fetchReels.mockReset();
  observer = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal("IntersectionObserver", vi.fn(function (fn) { callback = fn; return observer; }));
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Student reels", () => {
  it("loads published reels and mounts only the visible player", async () => {
    fetchReels.mockResolvedValue(items);
    const { container } = render(<StudentReels />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    const first = await screen.findByRole("region", { name: "Reel 1 of 2" });
    const second = screen.getByRole("region", { name: "Reel 2 of 2" });
    expect(fetchReels).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(observer.observe).toHaveBeenCalledTimes(2));
    act(() => callback([{ target: first, isIntersecting: true, intersectionRatio: 1 }]));
    expect(screen.getByTitle("Reel 1").getAttribute("loading")).toBe("lazy");
    expect(screen.getByTitle("Reel 1").src).not.toContain("autoplay=1");
    expect(within(first).getByRole("button", { name: "Previous reel" }).disabled).toBe(true);
    fireEvent.click(within(first).getByRole("button", { name: "Next reel" }));
    expect(screen.getByLabelText("Reels feed").scrollTo).toHaveBeenCalled();
    act(() => callback([{ target: first, isIntersecting: false, intersectionRatio: 0 }, { target: second, isIntersecting: true, intersectionRatio: 1 }]));
    expect(screen.queryByTitle("Reel 1")).toBeNull();
    expect(screen.getByTitle("Reel 2")).toBeTruthy();
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("iframe")).toBeNull();
    hidden.mockRestore();
    fireEvent.click(within(second).getByRole("button", { name: "Previous reel" }));
    expect(screen.getByLabelText("Reels feed").scrollTo).toHaveBeenCalledTimes(2);
    act(() => callback([{ target: second, isIntersecting: false, intersectionRatio: 0 }]));
    expect(container.querySelector("iframe")).toBeNull();
    expect(first.className).toContain("snap-start");
    expect(screen.getByLabelText("Reels feed").className).toContain("snap-y");
    expect(document.documentElement.style.scrollSnapType).toBe("");
  });

  it("shows empty and error states", async () => {
    fetchReels.mockResolvedValueOnce([]);
    const view = render(<StudentReels />);
    expect(await screen.findByText("No reels available yet.")).toBeTruthy();
    view.unmount();
    fetchReels.mockRejectedValueOnce(new Error("failed"));
    render(<StudentReels />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("protects the route and places the active sidebar link between Blog and Course orders", async () => {
    fetchReels.mockResolvedValue([]);
    const view = render(<MemoryRouter initialEntries={["/app/reels"]}><Routes><Route element={<RequireAuth />}><Route path="/app" element={<StudentLayout />}><Route path="reels" element={<StudentReels />} /></Route></Route><Route path="/login" element={<p>Login required</p>} /></Routes></MemoryRouter>);
    await screen.findByText("No reels available yet.");
    const nav = screen.getAllByRole("navigation", { name: "Student navigation" })[0];
    const links = within(nav).getAllByRole("link").map((link) => link.textContent);
    expect(links.indexOf("Reels")).toBe(links.indexOf("Blog") + 1);
    expect(links.indexOf("Course orders")).toBe(links.indexOf("Reels") + 1);
    expect(within(nav).getByRole("link", { name: "Reels" }).getAttribute("aria-current")).toBe("page");
    view.unmount();
    auth.isAuthenticated = false;
    render(<MemoryRouter initialEntries={["/app/reels"]}><Routes><Route element={<RequireAuth />}><Route path="/app/reels" element={<StudentReels />} /></Route><Route path="/login" element={<p>Login required</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText("Login required")).toBeTruthy();
  });
});
