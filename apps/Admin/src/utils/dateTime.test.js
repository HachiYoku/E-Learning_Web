import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateOnly, formatDateTime, formatWeekdayDateOnly } from "./dateTime";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Admin date and time formatting", () => {
  it("uses Asia/Bangkok regardless of the device timezone", () => {
    vi.stubEnv("TZ", "Asia/Yangon");
    expect(formatDate("2026-11-21T10:00:00.000Z")).toBe("21/11/2026");
    expect(formatDateTime("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 17:00");
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(formatDateTime("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 17:00");
  });

  it("preserves date-only calendar semantics for analytics", () => {
    expect(formatDateOnly("2026-05-04")).toBe("04/05/2026");
    expect(formatDateOnly("2024-02-29")).toBe("29/02/2024");
    expect(formatWeekdayDateOnly("2026-11-21")).toBe("Sat");
    expect(formatDateOnly("2026-02-29")).toBe("—");
  });

  it("handles missing and invalid timestamps safely", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});
