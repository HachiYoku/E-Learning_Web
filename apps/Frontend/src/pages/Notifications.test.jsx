import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Notifications from "./Notifications";
import { getSafeNotificationPath } from "../utils/notificationLink";

const state = vi.hoisted(() => ({ notifications: [], markAsRead: vi.fn(), markAllRead: vi.fn() }));

vi.mock("../components/Navbar", () => ({ default: () => null }));
vi.mock("../components/Footer", () => ({ default: () => null }));
vi.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({ notifications: state.notifications, loading: false, markAsRead: state.markAsRead, markAllRead: state.markAllRead }),
}));

function LocationProbe() {
  const location = useLocation();
  const { courseId, quizId } = useParams();
  return <output data-testid="location">{`${location.pathname}|${courseId}|${quizId}`}</output>;
}

function renderNotifications() {
  return render(<MemoryRouter initialEntries={["/app/notifications"]}><Routes><Route path="/app/notifications" element={<Notifications />} /><Route path="/app/course-quiz/:courseId/:quizId" element={<LocationProbe />} /></Routes></MemoryRouter>);
}

describe("Course Final notification links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.markAsRead.mockResolvedValue(undefined);
  });

  it.each([0x00, 0x1F, 0x7F])("rejects an embedded control character U+%s", (code) => {
    expect(getSafeNotificationPath(`/app/course-quiz/course-1/final-1?note=x${String.fromCharCode(code)}y`)).toBe("");
  });

  it("accepts a nearby printable character in an otherwise valid Course Final link", () => {
    expect(getSafeNotificationPath("/app/course-quiz/course-1/final-1?note=x!y"))
      .toBe("/app/course-quiz/course-1/final-1?note=x!y");
  });

  for (const [title, message] of [
    ["Extra quiz submission approved", "Your request was approved."],
    ["Extra quiz submission request declined", "Your request was not approved. Admin response: complete practice first."],
  ]) {
    it(`opens the Course Final for ${title}`, async () => {
      state.notifications = [{ _id: title, title, message, isRead: false, createdAt: "2026-10-05T00:00:00.000Z", courseId: "course-1", link: "/app/course-quiz/course-1/final-1" }];
      const user = userEvent.setup();
      renderNotifications();
      await user.click(screen.getByRole("button", { name: new RegExp(title, "i") }));
      expect(state.markAsRead).toHaveBeenCalledWith(title);
      expect((await screen.findByTestId("location")).textContent).toBe("/app/course-quiz/course-1/final-1|course-1|final-1");
    });
  }

  it("does not navigate for a malformed notification target", async () => {
    state.notifications = [{ _id: "unsafe", title: "Unsafe", message: "Unsafe", isRead: true, createdAt: "2026-10-05T00:00:00.000Z", link: "https://evil.example" }];
    const user = userEvent.setup();
    renderNotifications();
    await user.click(screen.getByRole("button", { name: /unsafe/i }));
    expect(screen.queryByTestId("location")).toBeNull();
  });

  for (const title of ["Extra quiz submission approved", "Extra quiz submission request declined"]) {
    it(`maps the legacy lesson-shaped target to the same Course Final for ${title}`, async () => {
      state.notifications = [{ _id: `legacy-${title}`, title, message: "Legacy notification", isRead: true, createdAt: "2026-10-05T00:00:00.000Z", courseId: "course-1", link: "/app/learn/course-1/quiz/final-1" }];
      const user = userEvent.setup();
      renderNotifications();
      await user.click(screen.getByRole("button", { name: new RegExp(title, "i") }));
      expect((await screen.findByTestId("location")).textContent).toBe("/app/course-quiz/course-1/final-1|course-1|final-1");
    });
  }

  it("does not map a legacy target whose route course conflicts with the notification course", async () => {
    state.notifications = [{ _id: "mismatch", title: "Extra quiz submission approved", message: "Mismatch", isRead: true, createdAt: "2026-10-05T00:00:00.000Z", courseId: "course-2", link: "/app/learn/course-1/quiz/final-1" }];
    const user = userEvent.setup();
    renderNotifications();
    await user.click(screen.getByRole("button", { name: /extra quiz submission approved/i }));
    expect(screen.queryByTestId("location")).toBeNull();
  });
});
