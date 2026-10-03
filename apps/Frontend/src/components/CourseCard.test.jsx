import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CourseCard from "./CourseCard";
import { CatalogueCurrencyContext } from "../contexts/catalogueCurrencyContext";

const course = {
  id: "course-1",
  title: "Thai Foundations",
  description: "Practical Thai for everyday conversations.",
  image: "",
  rating: 4,
  prices: {
    THB: { price: 4500, originalPrice: 4500 },
    MMK: { price: 280000, originalPrice: 280000 },
  },
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
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
});
