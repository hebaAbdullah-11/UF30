import assert from "node:assert/strict";
import test from "node:test";
import { computePrayerTimes } from "./prayers.ts";
import { isRamadan, parseMinute } from "./time.ts";

const riyadh = { latitude: 24.7136, longitude: 46.6753, timeZone: "Asia/Riyadh" };
const t = (hhmm: string) => parseMinute(hhmm)!;

function assertWithin(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: got ${actual}, expected ${expected} ±${tolerance}`);
}

// Muslim World League month table for Riyadh (truecalendar.com, Oct 2026). The calculation method only
// changes Fajr/Isha, so this independently checks the solar times shared with Umm al-Qura.
test("Riyadh solar times match a published table within a minute", () => {
  const got = computePrayerTimes("2026-10-01", riyadh, "mwl");
  const expected = { fajr: "04:29", sunrise: "05:44", dhuhr: "11:43", asr: "15:07", maghrib: "17:41", isha: "18:52" };
  for (const [name, hhmm] of Object.entries(expected)) {
    assertWithin(got[name as keyof typeof got], t(hhmm), 1, name);
  }
});

// Single published Umm al-Qura day for Riyadh (6 Jul 2026). That source rounds about 1–2 minutes later
// than the astronomical value, so the tolerance is 2 minutes; users can fine-tune each prayer in settings.
test("Riyadh Umm al-Qura times match the published reference within two minutes", () => {
  const got = computePrayerTimes("2026-07-06", riyadh, "umm_al_qura");
  const expected = { fajr: "03:40", sunrise: "05:11", dhuhr: "12:00", asr: "15:22", maghrib: "18:48", isha: "20:18" };
  for (const [name, hhmm] of Object.entries(expected)) {
    assertWithin(got[name as keyof typeof got], t(hhmm), 2, name);
  }
});

test("Umm al-Qura Isha is 90 minutes after Maghrib, 120 in Ramadan", () => {
  for (const day of ["2026-01-15", "2026-07-06", "2026-10-27", "2026-12-21"]) {
    assert.equal(isRamadan(day), false, day);
    const p = computePrayerTimes(day, riyadh, "umm_al_qura");
    assert.equal(p.isha - p.maghrib, 90, day);
  }
  for (const day of ["2026-02-25", "2026-03-01", "2027-02-20"]) {
    assert.equal(isRamadan(day), true, day);
    const p = computePrayerTimes(day, riyadh, "umm_al_qura");
    assert.equal(p.isha - p.maghrib, 120, day);
  }
});

test("prayers are in order and manual adjustments apply", () => {
  const base = computePrayerTimes("2026-10-27", riyadh);
  assert.ok(base.fajr < base.sunrise && base.sunrise < base.dhuhr && base.dhuhr < base.asr && base.asr < base.maghrib && base.maghrib < base.isha);
  const adjusted = computePrayerTimes("2026-10-27", riyadh, "umm_al_qura", { dhuhr: 2, isha: -5 });
  assert.equal(adjusted.dhuhr, base.dhuhr + 2);
  assert.equal(adjusted.isha, base.isha - 5);
  assert.equal(adjusted.asr, base.asr);
});

test("results do not depend on the machine's timezone", () => {
  const jeddah = { latitude: 21.5433, longitude: 39.1728, timeZone: "Asia/Riyadh" };
  const a = computePrayerTimes("2026-10-27", jeddah);
  assert.ok(a.dhuhr > t("12:00") && a.dhuhr < t("12:20"), `Jeddah dhuhr ${a.dhuhr}`);
});
