import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/adminStudentFeedbackService", () => ({ fetchAdminStudentFeedback: vi.fn(), fetchAdminStudentFeedbackDetail: vi.fn(), updateAdminStudentFeedbackPublication: vi.fn() }));
import StudentFeedback from "./StudentFeedback";
import { fetchAdminStudentFeedback, fetchAdminStudentFeedbackDetail, updateAdminStudentFeedbackPublication } from "../../services/adminStudentFeedbackService";

const awaiting = { _id: "feedback-1", student: { name: "Htet Linn Aung", email: "htet@example.test" }, course: { title: "Grammar Essentials" }, originalFeedback: "These lessons are practical, clear, and useful for daily Thai conversation.", createdAt: "2026-09-01T10:00:00.000Z", publicationConsent: { status: "permitted", namePreference: "first_name" }, publication: { status: "awaiting_review" }, publicNamePreview: "Htet" };
const response = { feedback: [awaiting], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };

beforeEach(() => { vi.resetAllMocks(); fetchAdminStudentFeedback.mockResolvedValue(response); fetchAdminStudentFeedbackDetail.mockResolvedValue({ feedback: awaiting }); });

describe("StudentFeedback admin review", () => {
  it("defaults to Awaiting Review", async () => {
    render(<StudentFeedback />);
    expect(await screen.findByText("Htet Linn Aung")).toBeTruthy();
    expect(fetchAdminStudentFeedback).toHaveBeenCalledWith({ status: "awaiting_review", page: 1 });
  });

  it("shows a loading state, list error, and retries the list", async () => {
    let resolveRequest;
    fetchAdminStudentFeedback.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const user = userEvent.setup(); render(<StudentFeedback />);
    expect(screen.getByText("Loading student feedback…")).toBeTruthy();
    resolveRequest(response);
    await screen.findByText("Htet Linn Aung");
    fetchAdminStudentFeedback.mockRejectedValueOnce(new Error("List unavailable"));
    await user.click(screen.getByRole("tab", { name: "Published" }));
    expect((await screen.findByRole("alert")).textContent).toContain("List unavailable");
    fetchAdminStudentFeedback.mockResolvedValueOnce(response);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchAdminStudentFeedback).toHaveBeenLastCalledWith({ status: "published", page: 1 }));
  });

  it("supports every server-side publication filter and an empty state", async () => {
    const user = userEvent.setup();
    fetchAdminStudentFeedback.mockResolvedValue({ feedback: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    render(<StudentFeedback />); await screen.findByText("No awaiting review feedback");
    for (const [label, status] of [["Published", "published"], ["Kept Private", "not_selected"], ["Sharing Withdrawn", "withdrawn"], ["Private Feedback", "private"]]) {
      await user.click(screen.getByRole("tab", { name: label }));
      await waitFor(() => expect(fetchAdminStudentFeedback).toHaveBeenLastCalledWith({ status, page: 1 }));
    }
    expect(screen.getByText("No private feedback")).toBeTruthy();
  });

  it("paginates feedback results", async () => {
    const user = userEvent.setup();
    fetchAdminStudentFeedback.mockResolvedValue({ ...response, pagination: { page: 1, limit: 20, total: 21, totalPages: 2 } });
    render(<StudentFeedback />); await screen.findByText("Htet Linn Aung");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(fetchAdminStudentFeedback).toHaveBeenLastCalledWith({ status: "awaiting_review", page: 2 }));
  });

  it("shows server-derived preview in permitted feedback detail", async () => {
    const user = userEvent.setup(); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText(/Display as:/)).toBeTruthy(); expect(screen.getByText("Htet")).toBeTruthy();
  });

  it("does not expose publication actions for private feedback", async () => {
    fetchAdminStudentFeedbackDetail.mockResolvedValue({ feedback: { ...awaiting, publicationConsent: { status: "private" }, publication: { status: "private" } } });
    const user = userEvent.setup(); render(<StudentFeedback />); await user.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Private feedback. Student has not granted permission for public sharing.")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Publish on Website" })).toBeNull(); expect(screen.queryByRole("button", { name: "Keep Private" })).toBeNull();
  });

  it("does not expose publication actions for withdrawn feedback", async () => {
    fetchAdminStudentFeedbackDetail.mockResolvedValue({ feedback: { ...awaiting, publicationConsent: { status: "withdrawn" }, publication: { status: "withdrawn" } } });
    const user = userEvent.setup(); render(<StudentFeedback />); await user.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Private feedback. Student has not granted permission for public sharing.")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Publish on Website" })).toBeNull(); expect(screen.queryByRole("button", { name: "Keep Private" })).toBeNull();
  });

  it("cancels publication without calling the endpoint", async () => {
    const user = userEvent.setup(); render(<StudentFeedback />); await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Publish on Website" }));
    await user.click(within(screen.getByRole("dialog", { name: "Publish this student story?" })).getByRole("button", { name: "Cancel" }));
    expect(updateAdminStudentFeedbackPublication).not.toHaveBeenCalled();
  });

  it("confirms and reports a successful publication", async () => {
    const user = userEvent.setup(); updateAdminStudentFeedbackPublication.mockResolvedValue({ feedback: { ...awaiting, publication: { status: "published" } } }); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Publish on Website" })); await user.click(within(screen.getByRole("dialog", { name: "Publish this student story?" })).getByRole("button", { name: "Publish on Website" }));
    await waitFor(() => expect(updateAdminStudentFeedbackPublication).toHaveBeenCalledWith("feedback-1", "published")); expect((await screen.findByRole("status")).textContent).toContain("Selected for website publication");
  });

  it("shows a publication failure without claiming success", async () => {
    const user = userEvent.setup(); updateAdminStudentFeedbackPublication.mockRejectedValue(new Error("Unable to publish")); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Publish on Website" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish on Website" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to publish"); expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a stale publication conflict without claiming a decision", async () => {
    const user = userEvent.setup(); updateAdminStudentFeedbackPublication.mockRejectedValue(new Error("This feedback is no longer eligible")); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Publish on Website" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish on Website" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no longer eligible"); expect(screen.queryByRole("status")).toBeNull();
  });

  it("cancels keeping feedback private without calling the endpoint", async () => {
    const user = userEvent.setup(); render(<StudentFeedback />); await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Keep Private" }));
    await user.click(within(screen.getByRole("dialog", { name: "Keep this feedback private?" })).getByRole("button", { name: "Cancel" })); expect(updateAdminStudentFeedbackPublication).not.toHaveBeenCalled();
  });

  it("confirms and reports successfully keeping feedback private", async () => {
    const user = userEvent.setup(); updateAdminStudentFeedbackPublication.mockResolvedValue({ feedback: { ...awaiting, publication: { status: "not_selected" } } }); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Keep Private" })); await user.click(within(screen.getByRole("dialog", { name: "Keep this feedback private?" })).getByRole("button", { name: "Keep Private" }));
    await waitFor(() => expect(updateAdminStudentFeedbackPublication).toHaveBeenCalledWith("feedback-1", "not_selected")); expect((await screen.findByRole("status")).textContent).toContain("Kept private");
  });

  it("shows a keep-private failure without claiming success", async () => {
    const user = userEvent.setup(); updateAdminStudentFeedbackPublication.mockRejectedValue(new Error("Unable to keep private")); render(<StudentFeedback />);
    await user.click(await screen.findByRole("button", { name: "Review" })); await user.click(screen.getByRole("button", { name: "Keep Private" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep Private" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to keep private"); expect(screen.queryByRole("status")).toBeNull();
  });
});
