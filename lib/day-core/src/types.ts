/** Minutes after local midnight (0–1439) in the user's timezone. */
export type Minute = number;
/** A local calendar date in the user's timezone, `YYYY-MM-DD`. */
export type DayKey = string;

export const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];
export type PrayerTimes = Record<PrayerName, Minute> & { sunrise: Minute };

export const PRAYER_METHODS = ["umm_al_qura", "mwl", "egyptian", "karachi", "dubai"] as const;
export type PrayerMethod = (typeof PRAYER_METHODS)[number];
/** Per-prayer correction in minutes (e.g. { isha: 2 }) applied after calculation. */
export type PrayerAdjustments = Partial<Record<PrayerName, number>>;

export const ITEM_TYPES = ["task", "exercise", "meditation", "reading", "habit", "reminder"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type Recurrence =
  | { kind: "once"; date: DayKey }
  | { kind: "daily" }
  /** 0 = Sunday … 6 = Saturday. */
  | { kind: "weekly"; weekdays: number[] };

export type Timing =
  | { kind: "fixed"; startMinute: Minute }
  | { kind: "prayer"; prayer: PrayerName; offsetMinutes: number }
  | { kind: "anytime" };

export type DayStart = "midnight" | "fajr";

export interface PlannedItem {
  id: string;
  title: string;
  type: ItemType;
  timing: Timing;
  durationMinutes: number;
  recurrence: Recurrence;
  sortOrder: number;
  hidden?: boolean;
}

export type LogStatus = "done" | "snoozed" | "skipped";
/** Today's latest log for an entry; `key` is an item id or `prayer:<name>`. */
export interface EntryLog {
  key: string;
  status: LogStatus;
  snoozedUntil?: Minute | null;
}

export type EntryStatus = "pending" | LogStatus;

export interface TimelineEntry {
  key: string;
  kind: "item" | "prayer";
  itemId?: string;
  prayer?: PrayerName;
  title?: string;
  type: ItemType | "prayer";
  /** Planned start; null for "any time today" items. */
  startMinute: Minute | null;
  durationMinutes: number;
  status: EntryStatus;
  snoozedUntil?: Minute | null;
  anchor?: { prayer: PrayerName; offsetMinutes: number };
  sortOrder: number;
}
