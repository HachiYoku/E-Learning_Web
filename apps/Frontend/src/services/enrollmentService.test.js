import { describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiClient: { get: vi.fn() } }));

import { normalizeEnrollment } from "./enrollmentService";

describe("normalizeEnrollment", () => {
  it("preserves access/progress when a retained enrollment no longer has historical payment data", () => {
    const enrollment = normalizeEnrollment({
      _id: "enrollment-1",
      courseId: { _id: "course-1", title: "Thai Basics", isPublished: true },
      paymentId: null,
      progress: { completedLessonIds: ["lesson-1"], completedLessons: 1, totalLessons: 5, percentage: 20 },
    });
    expect(enrollment.course.id).toBe("course-1");
    expect(enrollment.payment).toBeNull();
    expect(enrollment.progress.completedLessonIds).toEqual(["lesson-1"]);
  });
});
