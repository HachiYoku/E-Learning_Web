import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

import { apiClient } from "../api/client";
import { createStudentFeedback, fetchMyStudentFeedback, updateStudentFeedbackPublicationConsent } from "./studentFeedbackService";

beforeEach(() => vi.clearAllMocks());

describe("student feedback service", () => {
  it("uses the private feedback endpoints and returns only response feedback", async () => {
    apiClient.get.mockResolvedValue({ feedback: [{ _id: "feedback-1" }] });
    apiClient.post.mockResolvedValue({ feedback: { _id: "feedback-2" } });
    apiClient.patch.mockResolvedValue({ feedback: { _id: "feedback-2", publicationConsent: { status: "permitted" } } });

    await expect(fetchMyStudentFeedback()).resolves.toEqual([{ _id: "feedback-1" }]);
    await expect(createStudentFeedback({ courseId: "course-1", feedback: "Helpful practical Thai lessons." })).resolves.toEqual({ _id: "feedback-2" });
    await expect(updateStudentFeedbackPublicationConsent("feedback-2", { status: "permitted", namePreference: "anonymous" })).resolves.toMatchObject({ _id: "feedback-2" });

    expect(apiClient.get).toHaveBeenCalledWith("/student-feedback/mine");
    expect(apiClient.post).toHaveBeenCalledWith("/student-feedback", { courseId: "course-1", feedback: "Helpful practical Thai lessons." });
    expect(apiClient.patch).toHaveBeenCalledWith("/student-feedback/feedback-2/publication-consent", { status: "permitted", namePreference: "anonymous" });
  });

  it("normalizes a missing feedback list to an empty array", async () => {
    apiClient.get.mockResolvedValue({});
    await expect(fetchMyStudentFeedback()).resolves.toEqual([]);
  });
});
