import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CourseDetail from "./CourseDetail";
import { CatalogueCurrencyContext } from "../contexts/catalogueCurrencyContext";

vi.mock("../services/courseService", () => ({
  fetchCourseById: vi.fn(),
  fetchCourses: vi.fn(),
}));
vi.mock("../services/enrollmentService", () => ({ fetchMyEnrollments: vi.fn() }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../components/Navbar", () => ({ default: () => null }));
vi.mock("../components/Footer", () => ({ default: () => null }));
vi.mock("../components/Seo", () => ({ default: () => null }));

import { fetchCourseById, fetchCourses } from "../services/courseService";
import { fetchMyEnrollments } from "../services/enrollmentService";
import { useAuth } from "../contexts/AuthContext";

const course = {
  id: "course-1",
  title: "Thai Foundations",
  description: "Practical Thai for everyday conversations.",
  fullDescription: "Practical Thai for everyday conversations.",
  image: "",
  rating: 4,
  lessons: 8,
  features: ["Build useful Thai phrases"],
  prices: { THB: { price: 4500, originalPrice: 4500 } },
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderDetail() {
  return render(
    <CatalogueCurrencyContext.Provider value={{ currency: "THB", setCurrency: vi.fn() }}>
      <MemoryRouter initialEntries={["/courses/course-1"]}>
        <CourseDetail />
        <LocationProbe />
      </MemoryRouter>
    </CatalogueCurrencyContext.Provider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchCourseById.mockResolvedValue(course);
  fetchCourses.mockResolvedValue([course]);
});

describe("CourseDetail enrollment CTA", () => {
  it("shows Learn Now for an enrolled learner and routes to their course", async () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    fetchMyEnrollments.mockResolvedValue([{ course: { id: "course-1" } }]);
    renderDetail();

    const learnNow = await screen.findByRole("button", { name: "Learn Now" });
    expect(screen.queryByRole("button", { name: "Enroll now" })).toBeNull();
    fireEvent.click(learnNow);
    expect(screen.getByTestId("location").textContent).toBe("/app/learn/course-1");
  });

  it("preserves the enrollment route for an authenticated learner who is not enrolled", async () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    fetchMyEnrollments.mockResolvedValue([]);
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Enroll now" }));
    expect(screen.getByTestId("location").textContent).toBe("/enroll/course-1");
  });

  it("preserves the logged-out enrollment entry route", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Enroll now" }));
    expect(screen.getByTestId("location").textContent).toBe("/enroll/course-1");
    expect(fetchMyEnrollments).not.toHaveBeenCalled();
  });
});
