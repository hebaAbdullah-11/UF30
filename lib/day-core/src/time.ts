import type { DayKey, Minute } from "./types.ts";

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** The calendar date and minute-of-day of an instant in a timezone. */
export function zonedParts(instant: Date, timeZone: string): { dayKey: DayKey; minute: Minute } {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toUtcNoon(dayKey: DayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(dayKey: DayKey, days: number): DayKey {
  const date = toUtcNoon(dayKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(dayKey: DayKey): number {
  return toUtcNoon(dayKey).getUTCDay();
}

export function isValidDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toUtcNoon(value).toISOString().slice(0, 10) === value;
}

const hijriMonth = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "UTC" });
/** True when the date falls in Ramadan on the Umm al-Qura calendar. */
export function isRamadan(dayKey: DayKey): boolean {
  return hijriMonth.format(toUtcNoon(dayKey)).replace(/\D/g, "") === "9";
}

export function formatMinute(minute: Minute): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function parseMinute(hhmm: string): Minute | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
