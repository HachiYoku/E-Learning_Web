import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuizAttempts from "./QuizAttempts";

vi.mock("../../services/quizService", () => ({
  fetchQuizAttempts: vi.fn(),
  grantQuizAttempt: vi.fn(),
  reviewQuizAttemptRequest: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "quiz-1" }),
}));

import { fetchQuizAttempts, reviewQuizAttemptRequest } from "../../services/quizService";

const request = {
  _id: "request-1",
  user: { _id: "student-1", name: "Student One", email: "student@example.test" },
  status: "pending",
  reason: "Please let me practise one more time.",
  createdAt: "2026-10-05T00:00:00.000Z",
};

const payload = {
  quiz: { _id: "quiz-1", title: "Course Final", maxAttempts: 3 },
  attempts: [{ _id: "attempt-1", user: request.user, attemptNumber: 3, score: 2, total: 3, createdAt: "2026-10-05T00:00:00.000Z" }],
  grants: [],
  requests: [request],
  extraGrantsByStudent: {},
  goalReachedStudentIds: [],
};

function renderPage() {
  return render(<QuizAttempts />);
}

async function openReview(user) {
  await user.click(await screen.findByRole("button", { name: /student one/i }));
  await user.click(screen.getByRole("button", { name: /review request/i }));
  await screen.findByRole("dialog", { name: /review student one's request/i });
}

describe("QuizAttempts request review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchQuizAttempts.mockResolvedValue(payload);
    reviewQuizAttemptRequest.mockResolvedValue({ decision: "approved" });
  });

  it("approves a pending request through the exported review service", async () => {
    const user = userEvent.setup();
    renderPage();
    await openReview(user);
    await user.type(screen.getByRole("textbox", { name: /response/i }), "Approved for a final practice attempt.");
    await user.click(screen.getByRole("button", { name: /approve \+1/i }));
    await waitFor(() => expect(reviewQuizAttemptRequest).toHaveBeenCalledWith("quiz-1", "request-1", "approved", "Approved for a final practice attempt."));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchQuizAttempts).toHaveBeenCalledTimes(2);
  });

  it("requires a reason before rejecting and submits that rejection through the review service", async () => {
    const user = userEvent.setup();
    renderPage();
    await openReview(user);
    const reject = screen.getByRole("button", { name: "Reject" });
    expect(reject.disabled).toBe(true);
    await user.type(screen.getByRole("textbox", { name: /response/i }), "Please complete the assigned practice first.");
    await user.click(reject);
    await waitFor(() => expect(reviewQuizAttemptRequest).toHaveBeenCalledWith("quiz-1", "request-1", "rejected", "Please complete the assigned practice first."));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
