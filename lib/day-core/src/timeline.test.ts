import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, currentDay, getNowItem, scoreDay } from "./timeline.ts";
import { occursOn } from "./recurrence.ts";
import { parseMinute } from "./time.ts";
import type { EntryLog, PlannedItem, PrayerTimes } from "./types.ts";

const t = (hhmm: string) => parseMinute(hhmm)!;
const prayers: PrayerTimes = {
  fajr: t("04:38"), sunrise: t("05:57"), dhuhr: t("11:37"), asr: t("14:51"), maghrib: t("17:17"), isha: t("18:47"),
};
const DAY = "2026-10-27"; // Tuesday

function item(id: string, partial: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id, title: id, type: "task", timing: { kind: "anytime" }, durationMinutes: 25,
    recurrence: { kind: "daily" }, sortOrder: 0, ...partial,
  };
}

const items: PlannedItem[] = [
  item("morning-meditation", { type: "meditation", timing: { kind: "prayer", prayer: "fajr", offsetMinutes: 10 }, durationMinutes: 10 }),
  item("deep-work", { timing: { kind: "fixed", startMinute: t("09:00") }, durationMinutes: 90 }),
  item("midday-meditation", { type: "meditation", timing: { kind: "prayer", prayer: "dhuhr", offsetMinutes: 15 }, durationMinutes: 10 }),
  item("reading", { type: "reading", timing: { kind: "fixed", startMinute: t("20:00") }, durationMinutes: 30 }),
  item("call-mom", { timing: { kind: "anytime" }, durationMinutes: 15, sortOrder: 1 }),
  item("gym", { type: "exercise", timing: { kind: "fixed", startMinute: t("17:30") }, recurrence: { kind: "weekly", weekdays: [0, 2, 4] } }),
  item("friday-only", { timing: { kind: "fixed", startMinute: t("10:00") }, recurrence: { kind: "weekly", weekdays: [5] } }),
  item("hidden", { timing: { kind: "fixed", startMinute: t("09:30") }, hidden: true }),
  item("once-today", { timing: { kind: "fixed", startMinute: t("13:00") }, recurrence: { kind: "once", date: DAY } }),
  item("once-tomorrow", { timing: { kind: "fixed", startMinute: t("13:00") }, recurrence: { kind: "once", date: "2026-10-28" } }),
];

const build = (logs: EntryLog[] = [], p: PrayerTimes | null = prayers) => buildTimeline({ dayKey: DAY, items, prayers: p, logs });

test("timeline includes prayers and today's items, resolves prayer anchors, and sorts by time", () => {
  const entries = build();
  const keys = entries.map((e) => e.key);
  assert.ok(!keys.includes("friday-only") && !keys.includes("hidden") && !keys.includes("once-tomorrow"));
  assert.ok(keys.includes("gym") && keys.includes("once-today"));
  assert.equal(entries.find((e) => e.key === "morning-meditation")!.startMinute, t("04:48"));
  assert.equal(entries.find((e) => e.key === "midday-meditation")!.startMinute, t("11:52"));
  const timed = entries.filter((e) => e.startMinute !== null).map((e) => e.startMinute!);
  assert.deepEqual(timed, [...timed].sort((a, b) => a - b));
  assert.equal(entries.at(-1)!.key, "call-mom", "any-time items come last");
});

test("prayer-anchored items move when prayer times change", () => {
  const later = { ...prayers, dhuhr: prayers.dhuhr + 7 };
  const entry = buildTimeline({ dayKey: DAY, items, prayers: later, logs: [] }).find((e) => e.key === "midday-meditation")!;
  assert.equal(entry.startMinute, t("11:59"));
});

test("without a location, anchored items wait in any-time and no prayers are listed", () => {
  const entries = build([], null);
  assert.equal(entries.filter((e) => e.kind === "prayer").length, 0);
  assert.equal(entries.find((e) => e.key === "morning-meditation")!.startMinute, null);
});

const nowCases: { name: string; now: string; logs?: EntryLog[]; expect: { kind: string; key?: string } }[] = [
  { name: "during a fixed item", now: "09:30", expect: { kind: "current", key: "deep-work" } },
  { name: "at the exact start minute", now: "09:00", expect: { kind: "current", key: "deep-work" } },
  { name: "at the exact end minute the item is over", now: "10:30", expect: { kind: "anytime", key: "call-mom" } },
  { name: "during a prayer", now: "11:40", expect: { kind: "current", key: "prayer:dhuhr" } },
  { name: "an open prayer window comes before the item anchored after it", now: "11:55", expect: { kind: "current", key: "prayer:dhuhr" } },
  { name: "item anchored after a prayer once the prayer is done", now: "11:55", logs: [{ key: "prayer:dhuhr", status: "done" }], expect: { kind: "current", key: "midday-meditation" } },
  { name: "before dawn shows the next item", now: "03:00", logs: [{ key: "call-mom", status: "done" }], expect: { kind: "next", key: "prayer:fajr" } },
  { name: "a short gap prefers the next timed item over an any-time one", now: "08:50", expect: { kind: "next", key: "deep-work" } },
  { name: "a done current item is skipped", now: "09:30", logs: [{ key: "deep-work", status: "done" }], expect: { kind: "anytime", key: "call-mom" } },
  { name: "a snoozed item waits for its snooze time", now: "09:40", logs: [{ key: "deep-work", status: "snoozed", snoozedUntil: t("09:45") }], expect: { kind: "next", key: "deep-work" } },
  { name: "a long snooze leaves room for an any-time item", now: "09:40", logs: [{ key: "deep-work", status: "snoozed", snoozedUntil: t("10:10") }], expect: { kind: "anytime", key: "call-mom" } },
  { name: "a snoozed item is current again after the snooze", now: "09:50", logs: [{ key: "deep-work", status: "snoozed", snoozedUntil: t("09:45") }], expect: { kind: "current", key: "deep-work" } },
  { name: "overlap: the entry ending soonest wins", now: "17:35", expect: { kind: "current", key: "prayer:maghrib" } },
  { name: "late evening shows the last item", now: "20:10", expect: { kind: "current", key: "reading" } },
  { name: "missed items are not pushed onto the Now card", now: "23:00", logs: [{ key: "call-mom", status: "done" }], expect: { kind: "free" } },
];

for (const c of nowCases) {
  test(`now card: ${c.name}`, () => {
    const state = getNowItem(build(c.logs), t(c.now));
    assert.equal(state.kind, c.expect.kind);
    if (c.expect.key) assert.equal("entry" in state ? state.entry.key : undefined, c.expect.key);
  });
}

test("now card is 'clear' when everything is done", () => {
  const all = build().map((e) => ({ key: e.key, status: "done" as const }));
  assert.equal(getNowItem(build(all), t("12:00")).kind, "clear");
});

test("current item reports remaining minutes", () => {
  const state = getNowItem(build(), t("09:30"));
  assert.ok(state.kind === "current");
  assert.equal(state.remainingMinutes, 60);
});

test("score counts done over planned, optionally without prayers", () => {
  const logs: EntryLog[] = [{ key: "deep-work", status: "done" }, { key: "prayer:fajr", status: "done" }, { key: "reading", status: "skipped" }];
  const entries = build(logs);
  const withPrayers = scoreDay(entries, { countPrayers: true });
  assert.equal(withPrayers.planned, entries.length);
  assert.equal(withPrayers.done, 2);
  const withoutPrayers = scoreDay(entries, { countPrayers: false });
  assert.equal(withoutPrayers.planned, entries.length - 5);
  assert.equal(withoutPrayers.done, 1);
  assert.equal(scoreDay([], { countPrayers: true }).ratio, 0);
});

test("weekly recurrence uses Sunday = 0", () => {
  assert.equal(occursOn({ kind: "weekly", weekdays: [2] }, "2026-10-27"), true); // Tuesday
  assert.equal(occursOn({ kind: "weekly", weekdays: [5] }, "2026-10-30"), true); // Friday
  assert.equal(occursOn({ kind: "weekly", weekdays: [5] }, "2026-10-27"), false);
});

test("current day: midnight start vs Fajr start in Riyadh", () => {
  const riyadh = { latitude: 24.7136, longitude: 46.6753, timeZone: "Asia/Riyadh" };
  const at = (iso: string) => new Date(iso);
  // 02:00 Riyadh on 28 Oct (23:00 UTC on 27 Oct).
  assert.deepEqual(currentDay(at("2026-10-27T23:00:00Z"), { timeZone: "Asia/Riyadh", dayStart: "midnight", location: riyadh }), { dayKey: "2026-10-28", nowMinute: t("02:00") });
  assert.deepEqual(currentDay(at("2026-10-27T23:00:00Z"), { timeZone: "Asia/Riyadh", dayStart: "fajr", location: riyadh }), { dayKey: "2026-10-27", nowMinute: t("02:00") + 1440 });
  // 06:00 Riyadh is after Fajr: same day in both modes.
  assert.equal(currentDay(at("2026-10-28T03:00:00Z"), { timeZone: "Asia/Riyadh", dayStart: "fajr", location: riyadh }).dayKey, "2026-10-28");
});
