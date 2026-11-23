const DATE_PARTS = { day: "2-digit", month: "2-digit", year: "numeric" };

function validDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsToObject(parts) {
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function formatParts(date, options) {
  return partsToObject(new Intl.DateTimeFormat("en-GB", options).formatToParts(date));
}

export function formatDate(value, fallback = "—") {
  const date = validDate(value);
  if (!date) return fallback;
  const { day, month, year } = formatParts(date, DATE_PARTS);
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value, fallback = "—") {
  const date = validDate(value);
  if (!date) return fallback;
  const { day, month, year, hour, minute } = formatParts(date, { ...DATE_PARTS, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day}/${month}/${year}, ${hour}:${minute}`;
}

export function formatDateTime12Hour(value, fallback = "—") {
  const date = validDate(value);
  if (!date) return fallback;
  const { day, month, year } = formatParts(date, DATE_PARTS);
  const { hour, minute, dayPeriod } = partsToObject(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date));
  return `${day}/${month}/${year}, ${hour}:${minute} ${dayPeriod.toUpperCase()}`;
}

export const formatNotificationDateTime = formatDateTime12Hour;

export function formatDateOnly(value, fallback = "—") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return fallback;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
