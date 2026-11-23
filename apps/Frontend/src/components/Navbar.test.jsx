import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

const notificationState = { notifications: [], isOpen: false };
const authState = { isAuthenticated: false, user: null };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ ...authState, logout: vi.fn() }),
}));

vi.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    unreadCount: 0,
    isOpen: notificationState.isOpen,
    setIsOpen: vi.fn(),
    notifications: notificationState.notifications,
    loading: false,
    markAsRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

vi.mock("./LogoutConfirmModal", () => ({ default: () => null }));
vi.mock("../utils/dateTime", () => ({ formatNotificationDateTime: () => "FORMATTED NOTIFICATION" }));

describe("Navbar", () => {
  it("uses semantic desktop links and retains the menu toggle through tablet widths", () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Courses" }).getAttribute("href")).toBe("/courses");
    expect(screen.getByRole("navigation").innerHTML).toContain("hidden lg:flex");
    expect(screen.getByRole("button", { name: "Open navigation menu" }).className).toContain("lg:hidden");
  });

  it("uses the dedicated notification date formatter in the dropdown", () => {
    authState.isAuthenticated = true;
    authState.user = { name: "Student" };
    notificationState.isOpen = true;
    notificationState.notifications = [{ _id: "notice-1", title: "Payment approved", message: "You can start learning.", createdAt: "2026-11-21T10:00:00.000Z", isRead: false }];
    render(<MemoryRouter><Navbar /></MemoryRouter>);

    expect(screen.getByText("FORMATTED NOTIFICATION")).toBeTruthy();
    notificationState.isOpen = false;
    notificationState.notifications = [];
    authState.isAuthenticated = false;
    authState.user = null;
  });
});
