import { computePrayerTimes, type PrayerLocation } from "./prayers.ts";
import { occursOn } from "./recurrence.ts";
import { addDays, zonedParts } from "./time.ts";
import {
  PRAYER_NAMES,
  type DayKey,
  type DayStart,
  type EntryLog,
  type Minute,
  type PlannedItem,
  type PrayerAdjustments,
  type PrayerMethod,
  type PrayerTimes,
  type TimelineEntry,
} from "./types.ts";

export const PRAYER_DURATION_MINUTES = 20;

export interface BuildTimelineInput {
  dayKey: DayKey;
  items: PlannedItem[];
  prayers: PrayerTimes | null;
  logs: EntryLog[];
}

export const prayerKey = (name: string) => `prayer:${name}`;

/**
 * Everything planned for one day: prayers plus the items that occur that day,
 * with prayer-anchored items placed relative to that day's prayer times (so
 * they move whenever prayer times change). Sorted by start time; "any time
 * today" items (startMinute null) come last in their saved order.
 */
export function buildTimeline({ dayKey, items, prayers, logs }: BuildTimelineInput): TimelineEntry[] {
  const logByKey = new Map(logs.map((log) => [log.key, log]));
  const withLog = (entry: Omit<TimelineEntry, "status" | "snoozedUntil">): TimelineEntry => {
    const log = logByKey.get(entry.key);
    return {
      ...entry,
      status: log?.status ?? "pending",
      snoozedUntil: log?.status === "snoozed" ? log.snoozedUntil ?? null : null,
    };
  };

  const entries: TimelineEntry[] = [];
  if (prayers) {
    PRAYER_NAMES.forEach((name, index) => {
      entries.push(withLog({
        key: prayerKey(name),
        kind: "prayer",
        prayer: name,
        type: "prayer",
        startMinute: prayers[name],
        durationMinutes: PRAYER_DURATION_MINUTES,
        sortOrder: index,
      }));
    });
  }

  for (const item of items) {
    if (item.hidden || !occursOn(item.recurrence, dayKey)) continue;
    let startMinute: Minute | null = null;
    let anchor: TimelineEntry["anchor"];
    if (item.timing.kind === "fixed") startMinute = item.timing.startMinute;
    if (item.timing.kind === "prayer") {
      anchor = { prayer: item.timing.prayer, offsetMinutes: item.timing.offsetMinutes };
      // Without prayer times (no location yet) an anchored item waits in "any time today".
      startMinute = prayers ? prayers[item.timing.prayer] + item.timing.offsetMinutes : null;
    }
    entries.push(withLog({
      key: item.id,
      kind: "item",
      itemId: item.id,
      title: item.title,
      type: item.type,
      startMinute,
      durationMinutes: item.durationMinutes,
      anchor,
      sortOrder: item.sortOrder,
    }));
  }

  return entries.sort((a, b) => {
    if (a.startMinute === null || b.startMinute === null) {
      if (a.startMinute !== b.startMinute) return a.startMinute === null ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    }
    return a.startMinute - b.startMinute || (a.kind === "prayer" ? -1 : 0) - (b.kind === "prayer" ? -1 : 0) || a.sortOrder - b.sortOrder;
  });
}

/** Start used for "now" decisions: a snoozed entry starts again at its snooze time. */
export function effectiveStart(entry: TimelineEntry): Minute | null {
  if (entry.status === "snoozed" && entry.snoozedUntil != null) return entry.snoozedUntil;
  return entry.startMinute;
}

export type NowState =
  | { kind: "current"; entry: TimelineEntry; startMinute: Minute; endMinute: Minute; remainingMinutes: number }
  | { kind: "next"; entry: TimelineEntry; startMinute: Minute; startsInMinutes: number }
  | { kind: "anytime"; entry: TimelineEntry; next: TimelineEntry | null }
  | { kind: "free"; next: null }
  | { kind: "clear" };

const isOpen = (entry: TimelineEntry) => entry.status === "pending" || entry.status === "snoozed";

/**
 * The single thing the Now card shows.
 * 1. An open entry whose window contains `now` (the one ending soonest wins).
 * 2. Otherwise an open "any time today" item, if it fits before the next timed one.
 * 3. Otherwise the next upcoming open entry.
 * 4. Otherwise "clear" when everything planned is done, else "free".
 * Entries whose window already passed are not shown here (no catching-up pressure).
 */
export function getNowItem(entries: TimelineEntry[], now: Minute): NowState {
  let current: { entry: TimelineEntry; start: Minute; end: Minute } | null = null;
  let next: { entry: TimelineEntry; start: Minute } | null = null;
  let anytime: TimelineEntry | null = null;

  for (const entry of entries) {
    if (!isOpen(entry)) continue;
    const start = effectiveStart(entry);
    if (start === null) {
      if (!anytime) anytime = entry;
      continue;
    }
    const end = start + entry.durationMinutes;
    if (start <= now && now < end) {
      if (!current || end < current.end || (end === current.end && entry.sortOrder < current.entry.sortOrder)) {
        current = { entry, start, end };
      }
    } else if (start > now && (!next || start < next.start)) {
      next = { entry, start };
    }
  }

  if (current) {
    return { kind: "current", entry: current.entry, startMinute: current.start, endMinute: current.end, remainingMinutes: current.end - now };
  }
  if (anytime && (!next || next.start - now >= anytime.durationMinutes)) {
    return { kind: "anytime", entry: anytime, next: next?.entry ?? null };
  }
  if (next) return { kind: "next", entry: next.entry, startMinute: next.start, startsInMinutes: next.start - now };
  return entries.length > 0 && entries.every((e) => !isOpen(e)) ? { kind: "clear" } : { kind: "free", next: null };
}

export interface DayScore {
  planned: number;
  done: number;
  /** done ÷ planned, 0–1; 0 when nothing is planned. */
  ratio: number;
}

/** Commitment score for a day. Prayers count unless the user turned that off. */
export function scoreDay(entries: TimelineEntry[], options: { countPrayers: boolean }): DayScore {
  const counted = entries.filter((e) => options.countPrayers || e.kind !== "prayer");
  const done = counted.filter((e) => e.status === "done").length;
  return { planned: counted.length, done, ratio: counted.length ? done / counted.length : 0 };
}

export interface CurrentDay {
  dayKey: DayKey;
  /** Minutes since the start of `dayKey`'s calendar date; ≥ 1440 between midnight and Fajr in Fajr mode. */
  nowMinute: Minute;
}

/**
 * Which planning day `instant` belongs to. With dayStart "fajr", the time
 * between midnight and Fajr still belongs to the previous day.
 */
export function currentDay(
  instant: Date,
  options: {
    timeZone: string;
    dayStart: DayStart;
    location: PrayerLocation | null;
    method?: PrayerMethod;
    adjustments?: PrayerAdjustments;
  },
): CurrentDay {
  const { dayKey, minute } = zonedParts(instant, options.timeZone);
  if (options.dayStart === "fajr" && options.location) {
    const fajr = computePrayerTimes(dayKey, options.location, options.method, options.adjustments).fajr;
    if (minute < fajr) return { dayKey: addDays(dayKey, -1), nowMinute: minute + 1440 };
  }
  return { dayKey, nowMinute: minute };
}
