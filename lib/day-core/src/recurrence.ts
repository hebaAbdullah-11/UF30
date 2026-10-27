import { weekday } from "./time.ts";
import type { DayKey, Recurrence } from "./types.ts";

export function occursOn(recurrence: Recurrence, dayKey: DayKey): boolean {
  switch (recurrence.kind) {
    case "once":
      return recurrence.date === dayKey;
    case "daily":
      return true;
    case "weekly":
      return recurrence.weekdays.includes(weekday(dayKey));
  }
}
