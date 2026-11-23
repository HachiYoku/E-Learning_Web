import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateOnly, formatDateTime, formatDateTime12Hour, formatNotificationDateTime } from "./dateTime";

afterEach(() => {
  vi.unstubAllEnvs();
});

function inTimeZone(timeZone, callback) {
  vi.stubEnv("TZ", timeZone);
  return callback();
}

describe("Student date and time formatting", () => {
  it("uses device-local DD/MM/YYYY and 24-hour time", () => {
    inTimeZone("Asia/Bangkok", () => {
      expect(formatDate("2026-11-21T10:00:00.000Z")).toBe("21/11/2026");
      expect(formatDateTime("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 17:00");
    });
    inTimeZone("Asia/Yangon", () => {
      expect(formatDateTime("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 16:30");
    });
  });

  it("formats reusable 12-hour timestamps with uppercase AM/PM and no seconds", () => {
    inTimeZone("Asia/Bangkok", () => {
      expect(formatDateTime12Hour("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 5:00 PM");
      expect(formatDateTime12Hour("2026-11-20T17:00:59.000Z")).toBe("21/11/2026, 12:00 AM");
      expect(formatDateTime12Hour("2026-11-21T05:00:59.000Z")).toBe("21/11/2026, 12:00 PM");
      expect(formatNotificationDateTime("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 5:00 PM");
    });
    inTimeZone("Asia/Yangon", () => {
      expect(formatDateTime12Hour("2026-11-21T10:00:00.000Z")).toBe("21/11/2026, 4:30 PM");
      expect(formatDateTime12Hour("2026-11-20T17:30:00.000Z")).toBe("21/11/2026, 12:00 AM");
    });
  });

  it("keeps date-only values calendar-safe and handles invalid values", () => {
    expect(formatDateOnly("2026-05-04")).toBe("04/05/2026");
    expect(formatDateOnly("2024-02-29")).toBe("29/02/2024");
    expect(formatDateOnly("2026-02-29")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
    expect(formatDateTime12Hour(undefined, "")).toBe("");
    expect(formatDateTime12Hour("not-a-date", "")).toBe("");
  });
});
