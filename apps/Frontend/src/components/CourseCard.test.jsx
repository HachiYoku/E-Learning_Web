import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import CourseCard from "./CourseCard";
import StudentExplore from "../pages/StudentExplore";
import Courses from "../pages/Courses";
import { CatalogueCurrencyContext } from "../contexts/catalogueCurrencyContext";

vi.mock("../services/courseService", () => ({ fetchCourses: vi.fn() }));
vi.mock("../services/enrollmentService", () => ({ fetchMyEnrollments: vi.fn() }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("./Navbar", () => ({ default: () => null }));
vi.mock("./Footer", () => ({ default: () => null }));
vi.mock("./Seo", () => ({ default: () => null }));
vi.mock("./SocialReels", () => ({ default: () => null }));
vi.mock("./ContactSection", () => ({ default: () => null }));

import { fetchCourses } from "../services/courseService";
import { fetchMyEnrollments } from "../services/enrollmentService";

const course = {
  id: "course-1",
  title: "Thai Foundations",
  description: "Practical Thai for everyday conversations.",
  image: "/course-thumbnail.jpg",
  rating: 4,
  prices: {
    THB: { price: 4500, originalPrice: 4500 },
    MMK: { price: 280000, originalPrice: 280000 },
  },
};

function LocationProbe() {
  const location = useLocation();
  return <><p data-testid="location">{location.pathname}</p><p data-testid="location-state">{JSON.stringify(location.state)}</p></>;
}

function CurrencyHarness({ initialCurrency, courseData = course }) {
  const [currency, setCurrency] = useState(initialCurrency);
  return (
    <CatalogueCurrencyContext.Provider value={{ currency, setCurrency }}>
      <MemoryRouter>
        <CourseCard course={courseData} />
        <LocationProbe />
      </MemoryRouter>
    </CatalogueCurrencyContext.Provider>
  );
}

describe("CourseCard currency availability", () => {
  it("shows the selected MMK price and normal enrollment CTA when MMK is configured", () => {
    render(<CurrencyHarness initialCurrency="MMK" />);

    expect(screen.getByText("Ks 280,000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enroll Now" })).toBeTruthy();
  });

  it("shows the selected THB price and normal enrollment CTA when THB is configured", () => {
    render(<CurrencyHarness initialCurrency="THB" />);

    expect(screen.getByText("฿4,500")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enroll Now" })).toBeTruthy();
  });

  it("requires an intentional MMK-to-THB switch before enrollment when MMK is unavailable", () => {
    const thbOnlyCourse = { ...course, prices: { THB: course.prices.THB } };
    render(<CurrencyHarness initialCurrency="MMK" courseData={thbOnlyCourse} />);

    expect(screen.getByText("MMK price unavailable — available in THB")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enroll Now" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show prices in THB" }));
    expect(screen.getByText("฿4,500")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enroll Now" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("requires an intentional THB-to-MMK switch before enrollment when THB is unavailable", () => {
    const mmkOnlyCourse = { ...course, prices: { MMK: course.prices.MMK } };
    render(<CurrencyHarness initialCurrency="THB" courseData={mmkOnlyCourse} />);

    expect(screen.getByText("THB price unavailable — available in MMK")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enroll Now" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show prices in MMK" }));
    expect(screen.getByText("Ks 280,000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enroll Now" })).toBeTruthy();
  });

  it("does not offer enrollment or a currency switch when no usable price exists", () => {
    render(<CurrencyHarness initialCurrency="THB" courseData={{ ...course, prices: {} }} />);

    expect(screen.getByText("THB price unavailable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enroll Now" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Show prices in/ })).toBeNull();
  });

  it("keeps the default public thumbnail presentation unchanged", () => {
    const { container } = render(<CurrencyHarness initialCurrency="THB" />);
    const image = screen.getByRole("img", { name: "Thai Foundations" });

    expect(image.className).toContain("object-cover");
    expect(image.className).toContain("group-hover:scale-105");
    expect(container.querySelector("img")?.parentElement?.className).toContain("md:h-[300px]");
  });

  it("uses a non-cropping 16:9 thumbnail when rendered in the Student list", () => {
    const { container } = render(
      <CatalogueCurrencyContext.Provider value={{ currency: "THB", setCurrency: () => {} }}>
        <MemoryRouter><CourseCard course={course} listLayout /></MemoryRouter>
      </CatalogueCurrencyContext.Provider>
    );
    const image = screen.getByRole("img", { name: "Thai Foundations" });
    const thumbnail = container.querySelector("img")?.parentElement;

    expect(image.className).toContain("object-contain");
    expect(image.className).not.toContain("object-cover");
    expect(image.className).not.toContain("group-hover:scale-105");
    expect(thumbnail?.className).toContain("aspect-video");
    expect(thumbnail?.className).toContain("md:w-[42%]");
    expect(thumbnail?.className).toContain("lg:w-[44%]");
    expect(thumbnail?.className).toContain("md:max-w-[30rem]");
    expect(thumbnail?.className).toContain("md:self-start");
  });

  it("carries the default public catalog origin to course details", () => {
    render(<CurrencyHarness initialCurrency="THB" />);

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses/course-1");
    expect(screen.getByTestId("location-state").textContent).toBe('{"courseListingOrigin":"/courses"}');
  });

  it("renders the Student Explore catalog as a single-column course list", async () => {
    fetchCourses.mockResolvedValue([course]);
    fetchMyEnrollments.mockResolvedValue([]);
    render(
      <CatalogueCurrencyContext.Provider value={{ currency: "THB", setCurrency: () => {} }}>
        <MemoryRouter><StudentExplore /><LocationProbe /></MemoryRouter>
      </CatalogueCurrencyContext.Provider>
    );

    const card = (await screen.findByRole("button", { name: "Enroll Now" })).closest("article");
    const grid = card?.parentElement;
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:gap-6");
    expect(grid?.className).not.toContain("lg:grid-cols-2");

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses/course-1");
    expect(screen.getByTestId("location-state").textContent).toBe('{"courseListingOrigin":"/app/explore"}');
  });

  it("renders the public catalog as a single-column non-cropping course list", async () => {
    fetchCourses.mockResolvedValue([course]);
    render(
      <CatalogueCurrencyContext.Provider value={{ currency: "THB", setCurrency: () => {} }}>
        <MemoryRouter><Courses /><LocationProbe /></MemoryRouter>
      </CatalogueCurrencyContext.Provider>
    );

    const image = await screen.findByRole("img", { name: "Thai Foundations" });
    const card = image.closest("article");
    const grid = card?.parentElement;
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:gap-6");
    expect(grid?.className).not.toContain("lg:grid-cols-2");
    expect(image.className).toContain("object-contain");
    expect(image.className).not.toContain("group-hover:scale-105");

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByTestId("location").textContent).toBe("/courses/course-1");
    expect(screen.getByTestId("location-state").textContent).toBe('{"courseListingOrigin":"/courses"}');
  });
});
