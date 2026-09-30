import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/enrollmentService", () => ({ fetchMyEnrollments: vi.fn() }));
vi.mock("../services/studentFeedbackService", () => ({ fetchMyStudentFeedback: vi.fn(), createStudentFeedback: vi.fn(), updateStudentFeedbackPublicationConsent: vi.fn() }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../components/Seo", () => ({ default: () => null }));

import StudentFeedback from "./StudentFeedback";
import RequireAuth from "../routes/RequireAuth";
import { useAuth } from "../contexts/AuthContext";
import { fetchMyEnrollments } from "../services/enrollmentService";
import { createStudentFeedback, fetchMyStudentFeedback, updateStudentFeedbackPublicationConsent } from "../services/studentFeedbackService";

const eligibleEnrollment = { id: "enrollment-1", course: { id: "course-1", title: "Thai Basics" }, progress: { completedLessons: 1 } };
const zeroProgressEnrollment = { id: "enrollment-2", course: { id: "course-2", title: "Thai Foundations" }, progress: { completedLessons: 0 } };
const privateFeedback = { _id: "feedback-1", courseId: "course-1", originalFeedback: "The course helps me speak Thai more confidently every day.", publicationConsent: { status: "private" }, publication: { status: "private" } };

function renderFeedback() { return render(<MemoryRouter><StudentFeedback /></MemoryRouter>); }

beforeEach(() => {
  vi.resetAllMocks();
  fetchMyEnrollments.mockResolvedValue([eligibleEnrollment]);
  fetchMyStudentFeedback.mockResolvedValue([]);
});

describe("StudentFeedback", () => {
  it("is available only through the existing protected-route pattern", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: false, user: null });
    render(<MemoryRouter initialEntries={["/app/feedback"]}><Routes><Route element={<RequireAuth />}><Route path="/app/feedback" element={<StudentFeedback />} /></Route><Route path="/login" element={<p>Login page</p>} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Login page")).toBeTruthy();
  });

  it("shows loading then retries a failed data request", async () => {
    fetchMyEnrollments.mockRejectedValueOnce(new Error("Network unavailable"));
    renderFeedback();
    expect(screen.getByLabelText("Loading feedback")).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toContain("Network unavailable");
    fetchMyEnrollments.mockResolvedValue([eligibleEnrollment]);
    fetchMyStudentFeedback.mockResolvedValue([]);
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("How has this course helped you?")).toBeTruthy();
  });

  it("explains zero-completed-lesson eligibility and excludes it from submission choices", async () => {
    fetchMyEnrollments.mockResolvedValue([zeroProgressEnrollment]);
    renderFeedback();
    expect(await screen.findByText("Complete a lesson first")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Thai Foundations" })).toBeNull();
  });

  it("shows already-submitted feedback instead of permitting a duplicate course submission", async () => {
    fetchMyEnrollments.mockResolvedValue([eligibleEnrollment, zeroProgressEnrollment]);
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    renderFeedback();
    expect(await screen.findByText("Your Feedback")).toBeTruthy();
    expect(screen.queryByText("How has this course helped you?")).toBeNull();
    expect(screen.getByText("Thai Basics")).toBeTruthy();
  });

  it("saves private feedback once, opens sharing choices, and keeps it private on request", async () => {
    const user = userEvent.setup();
    let resolveCreate;
    createStudentFeedback.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    renderFeedback();
    await user.click(await screen.findByRole("button", { name: "Course" }));
    await user.click(screen.getByRole("option", { name: "Thai Basics" }));
    await user.type(screen.getByLabelText("Your feedback"), "Too short");
    expect(screen.getByRole("button", { name: /save private feedback/i }).disabled).toBe(true);
    await user.clear(screen.getByLabelText("Your feedback"));
    await user.type(screen.getByLabelText("Your feedback"), "These practical lessons help me use Thai more confidently every day.");
    await user.click(screen.getByRole("button", { name: /save private feedback/i }));
    expect(createStudentFeedback).toHaveBeenCalledWith({ courseId: "course-1", feedback: "These practical lessons help me use Thai more confidently every day." });
    expect(screen.getByRole("button", { name: /saving feedback/i }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /saving feedback/i }));
    expect(createStudentFeedback).toHaveBeenCalledTimes(1);
    resolveCreate({ ...privateFeedback, _id: "feedback-new" });
    expect(await screen.findByText("Thank you for your feedback ✓")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Share your experience publicly?" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "First name" }).checked).toBe(false);
    expect(screen.getByRole("radio", { name: "Anonymous learner" }).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Allow Sharing" }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Keep Private" }));
    expect(await screen.findByRole("heading", { name: "Thank you for your feedback!" })).toBeTruthy();
    expect(screen.getByText("Your feedback has been saved privately and will help us improve the learning experience.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const feedbackHeading = screen.getByRole("heading", { name: "Your Feedback" });
    expect(feedbackHeading).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(feedbackHeading));
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("keeps sharing choices unselected and submits first-name permission explicitly", async () => {
    const user = userEvent.setup();
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    updateStudentFeedbackPublicationConsent.mockResolvedValue({ ...privateFeedback, publicationConsent: { status: "permitted", namePreference: "first_name" }, publication: { status: "awaiting_review" } });
    renderFeedback();
    await user.click(await screen.findByRole("button", { name: /choose sharing preference/i }));
    const firstName = screen.getByRole("radio", { name: "First name" });
    const anonymous = screen.getByRole("radio", { name: "Anonymous learner" });
    expect(firstName.checked).toBe(false); expect(anonymous.checked).toBe(false);
    expect(screen.getByRole("button", { name: "Allow Sharing" }).disabled).toBe(true);
    await user.click(firstName); await user.click(screen.getByRole("button", { name: "Allow Sharing" }));
    await waitFor(() => expect(updateStudentFeedbackPublicationConsent).toHaveBeenCalledWith("feedback-1", { status: "permitted", namePreference: "first_name", allowProfileImage: false }));
    expect(await screen.findByRole("heading", { name: "Thank you for sharing your experience!" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("Awaiting website review")).toBeTruthy();
  });

  it("sends explicit profile-photo consent only for a first-name preference with an existing avatar", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { avatar: "https://cdn.example.test/student-avatar.jpg" },
    });
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    updateStudentFeedbackPublicationConsent.mockResolvedValue({
      ...privateFeedback,
      publicationConsent: {
        status: "permitted",
        namePreference: "first_name",
        allowProfileImage: true,
      },
      publication: { status: "awaiting_review" },
    });

    renderFeedback();
    await user.click(
      await screen.findByRole("button", { name: /choose sharing preference/i })
    );
    await user.click(screen.getByRole("radio", { name: "First name" }));

    const photoConsent = screen.getByRole("checkbox", {
      name: "Show my profile photo with my feedback",
    });
    expect(photoConsent.checked).toBe(false);
    await user.click(photoConsent);

    // Anonymous consent must clear photo consent; returning to First name
    // intentionally starts unchecked rather than restoring an old choice.
    await user.click(screen.getByRole("radio", { name: "Anonymous learner" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "First name" }));
    expect(
      screen.getByRole("checkbox", {
        name: "Show my profile photo with my feedback",
      }).checked
    ).toBe(false);

    await user.click(
      screen.getByRole("checkbox", {
        name: "Show my profile photo with my feedback",
      })
    );
    await user.click(screen.getByRole("button", { name: "Allow Sharing" }));

    await waitFor(() =>
      expect(updateStudentFeedbackPublicationConsent).toHaveBeenCalledWith(
        "feedback-1",
        {
          status: "permitted",
          namePreference: "first_name",
          allowProfileImage: true,
        }
      )
    );
  });

  it("does not offer profile-photo consent when the authenticated student has no avatar", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ isAuthenticated: true, user: {} });
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    renderFeedback();
    await user.click(
      await screen.findByRole("button", { name: /choose sharing preference/i })
    );
    await user.click(screen.getByRole("radio", { name: "First name" }));
    expect(
      screen.queryByRole("checkbox", {
        name: "Show my profile photo with my feedback",
      })
    ).toBeNull();
  });

  it("resets temporary sharing choices when the modal is closed and reopened", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { avatar: "https://cdn.example.test/student-avatar.jpg" },
    });
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    renderFeedback();

    const trigger = await screen.findByRole("button", { name: /choose sharing preference/i });
    await user.click(trigger);
    await user.click(screen.getByRole("radio", { name: "First name" }));
    await user.click(screen.getByRole("checkbox", { name: "Show my profile photo with my feedback" }));
    await user.click(screen.getByRole("button", { name: "Close sharing options" }));

    await user.click(trigger);
    expect(screen.getByRole("radio", { name: "First name" }).checked).toBe(false);
    expect(screen.getByRole("radio", { name: "Anonymous learner" }).checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: "Show my profile photo with my feedback" })).toBeNull();
  });

  it("does not leak temporary sharing choices between different feedback records", async () => {
    const user = userEvent.setup();
    const secondFeedback = { ...privateFeedback, _id: "feedback-2", courseId: "course-2" };
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { avatar: "https://cdn.example.test/student-avatar.jpg" },
    });
    fetchMyEnrollments.mockResolvedValue([
      eligibleEnrollment,
      { ...eligibleEnrollment, course: { id: "course-2", title: "Thai Conversations" } },
    ]);
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback, secondFeedback]);
    renderFeedback();

    const triggers = await screen.findAllByRole("button", { name: /choose sharing preference/i });
    await user.click(triggers[0]);
    await user.click(screen.getByRole("radio", { name: "First name" }));
    await user.click(screen.getByRole("checkbox", { name: "Show my profile photo with my feedback" }));
    await user.click(screen.getByRole("button", { name: "Close sharing options" }));

    await user.click(triggers[1]);
    expect(screen.getByRole("radio", { name: "First name" }).checked).toBe(false);
    expect(screen.getByRole("radio", { name: "Anonymous learner" }).checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: "Show my profile photo with my feedback" })).toBeNull();
  });

  it("opens sharing choices after a new private save and updates that record after consent", async () => {
    const user = userEvent.setup();
    const created = { ...privateFeedback, _id: "feedback-new" };
    createStudentFeedback.mockResolvedValue(created);
    updateStudentFeedbackPublicationConsent.mockResolvedValue({ ...created, publicationConsent: { status: "permitted", namePreference: "anonymous" }, publication: { status: "awaiting_review" } });
    renderFeedback();
    await user.click(await screen.findByRole("button", { name: "Course" }));
    await user.click(screen.getByRole("option", { name: "Thai Basics" }));
    await user.type(screen.getByLabelText("Your feedback"), "These practical lessons help me use Thai more confidently every day.");
    await user.click(screen.getByRole("button", { name: /save private feedback/i }));
    expect(await screen.findByRole("dialog", { name: "Share your experience publicly?" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Anonymous learner" }));
    await user.click(screen.getByRole("button", { name: "Allow Sharing" }));
    await waitFor(() => expect(updateStudentFeedbackPublicationConsent).toHaveBeenCalledWith("feedback-new", { status: "permitted", namePreference: "anonymous", allowProfileImage: false }));
    expect(await screen.findByRole("heading", { name: "Thank you for sharing your experience!" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("Awaiting website review")).toBeTruthy();
  });

  it("submits anonymous permission without exposing a full-name option", async () => {
    const user = userEvent.setup();
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    updateStudentFeedbackPublicationConsent.mockResolvedValue({ ...privateFeedback, publicationConsent: { status: "permitted", namePreference: "anonymous" }, publication: { status: "awaiting_review" } });
    renderFeedback(); await user.click(await screen.findByRole("button", { name: /choose sharing preference/i }));
    expect(screen.queryByText(/full name/i)).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Anonymous learner" })); await user.click(screen.getByRole("button", { name: "Allow Sharing" }));
    await waitFor(() => expect(updateStudentFeedbackPublicationConsent).toHaveBeenCalledWith("feedback-1", { status: "permitted", namePreference: "anonymous", allowProfileImage: false }));
  });

  it("closes new-feedback sharing choices with Close or Escape and leaves feedback private", async () => {
    const user = userEvent.setup();
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    renderFeedback();
    const trigger = await screen.findByRole("button", { name: /choose sharing preference/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close sharing options" })));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep Private" }));
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close sharing options" }));
    await user.click(screen.getByRole("button", { name: "Close sharing options" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updateStudentFeedbackPublicationConsent).not.toHaveBeenCalled();
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("keeps feedback private and permits retry when sharing consent fails", async () => {
    const user = userEvent.setup();
    fetchMyStudentFeedback.mockResolvedValue([privateFeedback]);
    updateStudentFeedbackPublicationConsent.mockRejectedValue(new Error("Sharing is unavailable"));
    renderFeedback();
    await user.click(await screen.findByRole("button", { name: /choose sharing preference/i }));
    await user.click(screen.getByRole("radio", { name: "First name" }));
    await user.click(screen.getByRole("button", { name: "Allow Sharing" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Your feedback is still saved privately");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allow Sharing" }).disabled).toBe(false);
  });

  it("shows existing user-facing statuses", async () => {
    fetchMyEnrollments.mockResolvedValue([eligibleEnrollment, { ...eligibleEnrollment, course: { id: "course-2", title: "Thai Two" } }, { ...eligibleEnrollment, course: { id: "course-3", title: "Thai Three" } }, { ...eligibleEnrollment, course: { id: "course-4", title: "Thai Four" } }]);
    fetchMyStudentFeedback.mockResolvedValue([
      privateFeedback,
      { ...privateFeedback, _id: "feedback-2", courseId: "course-2", publicationConsent: { status: "permitted" }, publication: { status: "awaiting_review" } },
      { ...privateFeedback, _id: "feedback-3", courseId: "course-3", publicationConsent: { status: "permitted" }, publication: { status: "published" } },
      { ...privateFeedback, _id: "feedback-4", courseId: "course-4", publicationConsent: { status: "permitted" }, publication: { status: "not_selected" } },
    ]);
    renderFeedback();
    for (const label of ["Private", "Awaiting website review", "Published", "Not selected for website"]) expect(await screen.findByText(label)).toBeTruthy();
  });

  it("requires confirmation before withdrawing and updates immediately after success", async () => {
    const user = userEvent.setup();
    const permitted = { ...privateFeedback, publicationConsent: { status: "permitted", namePreference: "first_name" }, publication: { status: "published" } };
    fetchMyStudentFeedback.mockResolvedValue([permitted]);
    updateStudentFeedbackPublicationConsent.mockResolvedValue({ ...permitted, publicationConsent: { status: "withdrawn" }, publication: { status: "withdrawn" } });
    renderFeedback(); await user.click(await screen.findByRole("button", { name: "Withdraw Public Sharing" }));
    expect(screen.getByRole("dialog", { name: /withdraw public sharing/i })).toBeTruthy();
    expect(updateStudentFeedbackPublicationConsent).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Withdraw Public Sharing" }));
    await waitFor(() => expect(updateStudentFeedbackPublicationConsent).toHaveBeenCalledWith("feedback-1", { status: "withdrawn" }));
    expect(await screen.findByText("Sharing withdrawn")).toBeTruthy();
  });

  it("keeps permission visible and shows an error when withdrawal fails", async () => {
    const user = userEvent.setup(); const permitted = { ...privateFeedback, publicationConsent: { status: "permitted", namePreference: "anonymous" }, publication: { status: "awaiting_review" } };
    fetchMyStudentFeedback.mockResolvedValue([permitted]); updateStudentFeedbackPublicationConsent.mockRejectedValue(new Error("Unable to withdraw now"));
    renderFeedback(); await user.click(await screen.findByRole("button", { name: "Withdraw Public Sharing" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Withdraw Public Sharing" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to withdraw now");
    expect(screen.getAllByRole("button", { name: "Withdraw Public Sharing" })).toHaveLength(2);
  });
});
