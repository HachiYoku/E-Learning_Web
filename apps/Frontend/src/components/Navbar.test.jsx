import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn() }),
}));

vi.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    unreadCount: 0,
    isOpen: false,
    setIsOpen: vi.fn(),
    notifications: [],
    loading: false,
    markAsRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

vi.mock("./LogoutConfirmModal", () => ({ default: () => null }));

describe("Navbar", () => {
  it("uses semantic desktop links and retains the menu toggle through tablet widths", () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Courses" }).getAttribute("href")).toBe("/courses");
    expect(screen.getByRole("navigation").innerHTML).toContain("hidden lg:flex");
    expect(screen.getByRole("button", { name: "Open navigation menu" }).className).toContain("lg:hidden");
  });
});
