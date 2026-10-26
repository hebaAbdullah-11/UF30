import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UF30_REGISTRATION_STORAGE_KEY,
  UF30_WORKSPACE_STORAGE_KEY,
  cancelUF30FocusSession,
  clearUF30WorkspaceData,
  createEmptyUF30Workspace,
  finishUF30FocusSession,
  getUF30WeekStart,
  getUF30WeeklyProgress,
  isUF30ReminderDue,
  localCalendarDate,
  pauseUF30FocusSession,
  rateUF30Content,
  readUF30Workspace,
  remainingFocusMilliseconds,
  resumeUF30FocusSession,
  startUF30FocusSession,
  toggleSavedUF30Content,
  writeUF30Workspace,
  type UF30Storage,
  type UF30WorkspaceState,
} from './uf30-workspace-data.ts';
import { UF30_DISCOVERY_ITEMS } from './uf30-discovery-content.ts';
import { uf30Copy } from './uf30-copy.ts';

class MemoryStorage implements UF30Storage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function completedSession(date: Date, id: string, actualSeconds = 1200) {
  return {
    id, startedAt: date.getTime(), finishedAt: date.getTime() + actualSeconds * 1000,
    date: localCalendarDate(date), plannedMinutes: 25 as const, actualSeconds, mode: 'solo' as const,
  };
}

test('saves and restores focus duration, companion preference, and reminder preferences', () => {
  const storage = new MemoryStorage();
  const saved = {
    ...createEmptyUF30Workspace(),
    settings: {
      duration: 45 as const, mode: 'companion' as const, remindersEnabled: true,
      reminderTime: '08:45', reminderDays: [1, 3, 5],
    },
  };
  writeUF30Workspace(saved, storage);
  assert.deepEqual(readUF30Workspace(storage), saved);
});

for (const duration of [15, 25, 45] as const) {
  test(`${duration}-minute focus session counts down using wall-clock time`, () => {
    const started = startUF30FocusSession({
      ...createEmptyUF30Workspace(),
      settings: { ...createEmptyUF30Workspace().settings, duration },
    }, 1_000, 'synthetic-session');
    assert.equal(remainingFocusMilliseconds(started.activeSession!, 1_000), duration * 60_000);
    assert.equal(remainingFocusMilliseconds(started.activeSession!, 11_000), duration * 60_000 - 10_000);
    assert.equal(remainingFocusMilliseconds(started.activeSession!, 11_000 + duration * 60_000), 0);
    assert.equal(started.activeSession!.id, 'synthetic-session');
  });
}

test('pause, resume, and cancellation handle timer state without recording a fake completed session', () => {
  let state: UF30WorkspaceState = startUF30FocusSession(createEmptyUF30Workspace(), 1_000, 'paused-session');
  state = pauseUF30FocusSession(state, 8_000);
  assert.equal(remainingFocusMilliseconds(state.activeSession!, 100_000), 25 * 60_000 - 7_000);
  state = resumeUF30FocusSession(state, 108_000);
  assert.equal(state.activeSession!.pausedMs, 100_000);
  assert.equal(state.activeSession!.pausedAt, null);
  assert.equal(remainingFocusMilliseconds(state.activeSession!, 118_000), 25 * 60_000 - 17_000);
  const cancelled = cancelUF30FocusSession(state);
  assert.equal(cancelled.activeSession, null);
  assert.deepEqual(cancelled.sessions, []);
});

test('rejects starting a second active timer and finishing when none is active', () => {
  const state = startUF30FocusSession(createEmptyUF30Workspace(), 0, 'one');
  assert.throws(() => startUF30FocusSession(state, 1, 'two'), /active focus session/);
  assert.throws(() => finishUF30FocusSession(createEmptyUF30Workspace()), /no focus session/);
});

test('finishing a paused timer records the correct elapsed time in the start-day schedule', () => {
  const started = startUF30FocusSession({
    ...createEmptyUF30Workspace(),
    settings: { ...createEmptyUF30Workspace().settings, duration: 15, mode: 'companion' },
  }, new Date(2026, 3, 8, 10).getTime(), 'completed');
  let state = pauseUF30FocusSession(started, new Date(2026, 3, 8, 10, 3).getTime());
  state = resumeUF30FocusSession(state, new Date(2026, 3, 8, 10, 8).getTime());
  state = finishUF30FocusSession(state, new Date(2026, 3, 8, 10, 18).getTime());
  assert.equal(state.activeSession, null);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0]!.actualSeconds, 13 * 60);
  assert.equal(state.sessions[0]!.plannedMinutes, 15);
  assert.equal(state.sessions[0]!.mode, 'companion');
  assert.equal(state.sessions[0]!.date, '2026-04-08');
});

test('weekly progress uses the local Monday boundary and reflects today in the schedule', () => {
  const sunday = new Date(2026, 3, 12, 11);
  assert.equal(localCalendarDate(getUF30WeekStart(sunday)), '2026-04-06');
  const state = {
    ...createEmptyUF30Workspace(),
    sessions: [
      completedSession(new Date(2026, 3, 12, 9), 'today-1', 2700),
      completedSession(new Date(2026, 3, 6, 9), 'week-start', 900),
      completedSession(new Date(2026, 3, 5, 9), 'last-week', 600),
    ],
  };
  assert.deepEqual(getUF30WeeklyProgress(state, sunday), {
    sessions: 2, focusMinutes: 60, todaySessions: 1, todayFocusMinutes: 45,
    todaySchedule: [state.sessions[0]],
  });
});

test('reminders honor enabled state, weekday, local time, and once-daily suppression', () => {
  const state = {
    ...createEmptyUF30Workspace(),
    settings: {
      ...createEmptyUF30Workspace().settings, remindersEnabled: true, reminderTime: '08:30', reminderDays: [1],
    },
  };
  assert.equal(isUF30ReminderDue(state, new Date(2026, 3, 6, 8, 30)), true);
  assert.equal(isUF30ReminderDue(state, new Date(2026, 3, 6, 8, 31)), false);
  assert.equal(isUF30ReminderDue(state, new Date(2026, 3, 7, 8, 30)), false);
  assert.equal(isUF30ReminderDue({ ...state, lastReminderNoticeDate: '2026-04-06' }, new Date(2026, 3, 6, 8, 30)), false);
  assert.equal(isUF30ReminderDue({ ...state, settings: { ...state.settings, remindersEnabled: false } }, new Date(2026, 3, 6, 8, 30)), false);
});

test('save and rating preferences are independent per verified content id', () => {
  let state = createEmptyUF30Workspace();
  state = toggleSavedUF30Content(state, 'published:research-01');
  state = rateUF30Content(state, 'published:research-01', 4);
  state = rateUF30Content(state, 'published:article-02', 2);
  assert.deepEqual(state.savedContentIds, ['published:research-01']);
  assert.deepEqual(state.contentRatings, { 'published:research-01': 4, 'published:article-02': 2 });
  state = toggleSavedUF30Content(state, 'published:research-01');
  assert.deepEqual(state.savedContentIds, []);
  assert.throws(() => toggleSavedUF30Content(state, '  '), /published content/);
  assert.throws(() => rateUF30Content(state, 'published:1', 6 as 1), /rating from one to five/);
});

test('unavailable editorial content is not replaced by fabricated catalogue entries', () => {
  assert.deepEqual(UF30_DISCOVERY_ITEMS, []);
  assert.equal(UF30_DISCOVERY_ITEMS.length, 0);
});

test('the UF30 interface defines the same translation keys in Arabic and English', () => {
  assert.deepEqual(
    Object.keys(uf30Copy.ar).sort(),
    Object.keys(uf30Copy.en).sort(),
    'Every visible UF30 key must have both Arabic and English text',
  );
});

test('deletion removes only the exact UF30 intake and workspace keys', () => {
  const storage = new MemoryStorage();
  storage.setItem(UF30_REGISTRATION_STORAGE_KEY, '{"answers":"synthetic"}');
  storage.setItem(UF30_WORKSPACE_STORAGE_KEY, JSON.stringify(createEmptyUF30Workspace()));
  storage.setItem('afta:profile:synthetic', '{"keep":true}');
  storage.setItem('afta-conversation:synthetic', '{"keep":true}');
  storage.setItem('user-preferences', '{"keep":true}');
  clearUF30WorkspaceData(storage);
  assert.equal(storage.getItem(UF30_REGISTRATION_STORAGE_KEY), null);
  assert.equal(storage.getItem(UF30_WORKSPACE_STORAGE_KEY), null);
  assert.equal(storage.getItem('afta:profile:synthetic'), '{"keep":true}');
  assert.equal(storage.getItem('afta-conversation:synthetic'), '{"keep":true}');
  assert.equal(storage.getItem('user-preferences'), '{"keep":true}');
});

test('invalid or corrupt workspace data fails without replacing the original entry', () => {
  const storage = new MemoryStorage();
  storage.setItem(UF30_WORKSPACE_STORAGE_KEY, '{corrupt');
  assert.throws(() => readUF30Workspace(storage), /not be read or saved/);
  assert.equal(storage.getItem(UF30_WORKSPACE_STORAGE_KEY), '{corrupt');
  assert.throws(() => writeUF30Workspace({ ...createEmptyUF30Workspace(), settings: { ...createEmptyUF30Workspace().settings, duration: 20 as 25 } }, storage), /not be validated/);
});
