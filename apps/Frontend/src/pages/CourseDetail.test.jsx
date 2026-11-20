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
  return <><p data-testid="location">{location.pathname}</p><p data-testid="location-state">{JSON.stringify(location.state)}</p></>;
}

function renderDetail(initialEntry = "/courses/course-1") {
  return render(
    <CatalogueCurrencyContext.Provider value={{ currency: "THB", setCurrency: vi.fn() }}>
      <MemoryRouter initialEntries={[initialEntry]}>
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
  it("returns to Student Explore when the validated listing origin is provided", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail({ pathname: "/courses/course-1", state: { courseListingOrigin: "/app/explore" } });

    fireEvent.click(await screen.findByRole("button", { name: "Back to courses" }));
    expect(screen.getByTestId("location").textContent).toBe("/app/explore");
  });

  it("returns to the public catalog for its validated listing origin", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail({ pathname: "/courses/course-1", state: { courseListingOrigin: "/courses" } });

    fireEvent.click(await screen.findByRole("button", { name: "Back to courses" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses");
  });

  it("falls back to the public catalog when the listing origin is missing", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Back to courses" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses");
  });

  it("falls back to the public catalog when the listing origin is invalid", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail({ pathname: "/courses/course-1", state: { courseListingOrigin: "https://untrusted.example" } });
    fireEvent.click(await screen.findByRole("button", { name: "Back to courses" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses");
  });

  it("keeps a missing hero image inside a 16:9 container", async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderDetail();

    const fallback = await screen.findByText("No image");
    const heroContainer = fallback.parentElement;
    expect(heroContainer?.className).toContain("aspect-video");
    expect(heroContainer?.className).toContain("bg-[#E7DCCE]");
  });

  it("shows the complete hero image without object-cover cropping", async () => {
    const courseWithImage = { ...course, image: "/course-thumbnail.jpg" };
    useAuth.mockReturnValue({ isAuthenticated: false });
    fetchCourseById.mockResolvedValue(courseWithImage);
    fetchCourses.mockResolvedValue([courseWithImage]);
    renderDetail();

    const image = await screen.findByRole("img", { name: "Thai Foundations" });
    expect(image.parentElement?.className).toContain("aspect-video");
    expect(image.className).toContain("object-contain");
    expect(image.className).not.toContain("object-cover");
  });

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

  it("renders recommendations as a single-column non-cropping course list", async () => {
    const relatedCourse = { ...course, id: "course-2", title: "Thai Conversation", image: "/course-thumbnail.jpg" };
    useAuth.mockReturnValue({ isAuthenticated: false });
    fetchCourses.mockResolvedValue([course, relatedCourse]);
    renderDetail();

    const image = await screen.findByRole("img", { name: "Thai Conversation" });
    const card = image.closest("article");
    const grid = card?.parentElement;
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:gap-6");
    expect(grid?.className).not.toContain("lg:grid-cols-2");
    expect(image.className).toContain("object-contain");
    expect(image.className).not.toContain("group-hover:scale-105");

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses/course-2");
    expect(screen.getByTestId("location-state").textContent).toBe('{"courseListingOrigin":"/courses"}');
  });

  it("preserves the validated Student Explore origin for related-course details", async () => {
    const relatedCourse = { ...course, id: "course-2", title: "Thai Conversation", image: "/course-thumbnail.jpg" };
    useAuth.mockReturnValue({ isAuthenticated: false });
    fetchCourses.mockResolvedValue([course, relatedCourse]);
    renderDetail({ pathname: "/courses/course-1", state: { courseListingOrigin: "/app/explore" } });

    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses/course-2");
    expect(screen.getByTestId("location-state").textContent).toBe('{"courseListingOrigin":"/app/explore"}');
  });
});
