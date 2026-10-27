import { CalculationMethod, Coordinates, Madhab, PrayerTimes as AdhanPrayerTimes } from "adhan";
import { isRamadan, zonedParts } from "./time.ts";
import type { DayKey, PrayerAdjustments, PrayerMethod, PrayerName, PrayerTimes } from "./types.ts";

export interface PrayerLocation {
  latitude: number;
  longitude: number;
  timeZone: string;
}

function parameters(method: PrayerMethod, dayKey: DayKey) {
  switch (method) {
    case "umm_al_qura": {
      const params = CalculationMethod.UmmAlQura();
      // Umm al-Qura sets Isha 90 minutes after Maghrib, and 120 during Ramadan.
      if (isRamadan(dayKey)) params.ishaInterval = 120;
      return params;
    }
    case "mwl":
      return CalculationMethod.MuslimWorldLeague();
    case "egyptian":
      return CalculationMethod.Egyptian();
    case "karachi":
      return CalculationMethod.Karachi();
    case "dubai":
      return CalculationMethod.Dubai();
  }
}

/**
 * Prayer times for one local date, as minutes after local midnight in
 * `location.timeZone`. Computed on the device; no network or third party.
 */
export function computePrayerTimes(
  dayKey: DayKey,
  location: PrayerLocation,
  method: PrayerMethod = "umm_al_qura",
  adjustments: PrayerAdjustments = {},
): PrayerTimes {
  const [year, month, day] = dayKey.split("-").map(Number);
  const params = parameters(method, dayKey);
  params.madhab = Madhab.Shafi;
  // adhan reads the calendar date from the Date's local fields.
  const times = new AdhanPrayerTimes(
    new Coordinates(location.latitude, location.longitude),
    new Date(year, month - 1, day),
    params,
  );
  const minute = (instant: Date) => zonedParts(instant, location.timeZone).minute;
  const result: PrayerTimes = {
    fajr: minute(times.fajr),
    sunrise: minute(times.sunrise),
    dhuhr: minute(times.dhuhr),
    asr: minute(times.asr),
    maghrib: minute(times.maghrib),
    isha: minute(times.isha),
  };
  for (const [name, delta] of Object.entries(adjustments) as [PrayerName, number][]) {
    if (Number.isFinite(delta)) result[name] += delta;
  }
  return result;
}
