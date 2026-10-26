/**
 * UF30-only browser storage. AFTA auth, conversations, profiles, and preferences
 * are deliberately outside these exact storage keys.
 */
export const UF30_REGISTRATION_STORAGE_KEY = 'uf30-introductory-registration-v1';
export const UF30_WORKSPACE_STORAGE_KEY = 'uf30-focus-discover-profile-v1';
export const UF30_WORKSPACE_PAGES = ['focus', 'discover', 'me'] as const;

export type UF30WorkspacePage = (typeof UF30_WORKSPACE_PAGES)[number];
export type FocusMinutes = 15 | 25 | 45;
export type FocusMode = 'solo' | 'companion';
export type ContentKind = 'podcast' | 'article' | 'exercise';
export type ContentRating = 1 | 2 | 3 | 4 | 5;

/** Published entries only. Unavailable editorial content is not represented by made-up examples. */
export type UF30DiscoveryItem = {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
};

export type UF30Settings = {
  duration: FocusMinutes;
  mode: FocusMode;
  remindersEnabled: boolean;
  reminderTime: string;
  reminderDays: number[];
};

export type UF30ActiveSession = {
  id: string;
  startedAt: number;
  duration: FocusMinutes;
  mode: FocusMode;
  pausedAt: number | null;
  pausedMs: number;
};

export type UF30CompletedSession = {
  id: string;
  startedAt: number;
  finishedAt: number;
  date: string;
  plannedMinutes: FocusMinutes;
  actualSeconds: number;
  mode: FocusMode;
};

export type UF30WorkspaceState = {
  version: 1;
  settings: UF30Settings;
  activeSession: UF30ActiveSession | null;
  sessions: UF30CompletedSession[];
  savedContentIds: string[];
  contentRatings: Record<string, ContentRating>;
  lastReminderNoticeDate: string | null;
};

export type UF30Storage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Listener = () => void;

const MAX_SAVED_SESSIONS = 2000;
const listeners = new Set<Listener>();

export class UF30StorageError extends Error {
  constructor(message = 'UF30 data could not be read or saved on this device.') {
    super(message);
    this.name = 'UF30StorageError';
  }
}

export function createEmptyUF30Workspace(): UF30WorkspaceState {
  return {
    version: 1,
    settings: {
      duration: 25,
      mode: 'solo',
      remindersEnabled: false,
      reminderTime: '09:00',
      reminderDays: [1, 2, 3, 4, 5],
    },
    activeSession: null,
    sessions: [],
    savedContentIds: [],
    contentRatings: {},
    lastReminderNoticeDate: null,
  };
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidState(value: unknown): value is UF30WorkspaceState {
  if (!isObject(value) || value.version !== 1 || !isObject(value.settings)) return false;
  const settings = value.settings;
  if (![15, 25, 45].includes(settings.duration as number) ||
    !['solo', 'companion'].includes(String(settings.mode)) ||
    typeof settings.remindersEnabled !== 'boolean' ||
    !validTime(settings.reminderTime) ||
    !Array.isArray(settings.reminderDays) ||
    !settings.reminderDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) ||
    !Array.isArray(value.sessions) || value.sessions.length > MAX_SAVED_SESSIONS ||
    (value.activeSession !== null && !isObject(value.activeSession)) ||
    !Array.isArray(value.savedContentIds) || !value.savedContentIds.every((id) => typeof id === 'string') ||
    !isObject(value.contentRatings) ||
    !Object.values(value.contentRatings).every((rating) => Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5) ||
    !(value.lastReminderNoticeDate === null || typeof value.lastReminderNoticeDate === 'string')) {
    return false;
  }
  if (value.activeSession !== null) {
    const session = value.activeSession;
    if (typeof session.id !== 'string' ||
      !Number.isFinite(session.startedAt) ||
      ![15, 25, 45].includes(session.duration as number) ||
      !['solo', 'companion'].includes(String(session.mode)) ||
      !(session.pausedAt === null || Number.isFinite(session.pausedAt)) ||
      !Number.isFinite(session.pausedMs) ||
      Number(session.pausedMs) < 0) return false;
  }
  return value.sessions.every((entry) =>
    isObject(entry) && typeof entry.id === 'string' &&
    Number.isFinite(entry.startedAt) && Number.isFinite(entry.finishedAt) &&
    typeof entry.date === 'string' &&
    [15, 25, 45].includes(entry.plannedMinutes as number) &&
    Number.isInteger(entry.actualSeconds) && Number(entry.actualSeconds) >= 0 &&
    ['solo', 'companion'].includes(String(entry.mode)));
}

function browserStorage(): UF30Storage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) throw new UF30StorageError();
    return window.localStorage;
  } catch (error) {
    if (error instanceof UF30StorageError) throw error;
    throw new UF30StorageError();
  }
}

export function readUF30Workspace(storage = browserStorage()): UF30WorkspaceState {
  try {
    const raw = storage.getItem(UF30_WORKSPACE_STORAGE_KEY);
    if (raw === null) return createEmptyUF30Workspace();
    const value: unknown = JSON.parse(raw);
    if (!isValidState(value)) throw new UF30StorageError('UF30 data on this device is not in a supported format.');
    return value;
  } catch (error) {
    if (error instanceof UF30StorageError) throw error;
    throw new UF30StorageError();
  }
}

export function writeUF30Workspace(state: UF30WorkspaceState, storage = browserStorage()): void {
  if (!isValidState(state)) throw new UF30StorageError('UF30 changes could not be validated and were not saved.');
  try {
    storage.setItem(UF30_WORKSPACE_STORAGE_KEY, JSON.stringify(state));
    listeners.forEach((listener) => listener());
  } catch {
    throw new UF30StorageError();
  }
}

export function updateUF30Workspace(
  update: (current: UF30WorkspaceState) => UF30WorkspaceState,
  storage = browserStorage(),
): UF30WorkspaceState {
  const next = update(readUF30Workspace(storage));
  writeUF30Workspace(next, storage);
  return next;
}

/** Delete only the two known UF30 browser-storage entries; never scan or clear unrelated keys. */
export function clearUF30WorkspaceData(storage = browserStorage()): void {
  try {
    storage.removeItem(UF30_WORKSPACE_STORAGE_KEY);
    storage.removeItem(UF30_REGISTRATION_STORAGE_KEY);
    listeners.forEach((listener) => listener());
  } catch {
    throw new UF30StorageError('UF30 data could not be deleted from this device.');
  }
}

export function subscribeUF30Workspace(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === UF30_WORKSPACE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function localCalendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isUF30ReminderDue(state: UF30WorkspaceState, now = new Date()): boolean {
  if (!state.settings.remindersEnabled || state.lastReminderNoticeDate === localCalendarDate(now)) return false;
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return state.settings.reminderDays.includes(now.getDay()) && clock === state.settings.reminderTime;
}

export function startUF30FocusSession(
  state: UF30WorkspaceState,
  now = Date.now(),
  id = createSessionId(),
): UF30WorkspaceState {
  if (state.activeSession) throw new UF30StorageError('Finish or cancel the active focus session first.');
  return {
    ...state,
    activeSession: {
      id,
      startedAt: now,
      duration: state.settings.duration,
      mode: state.settings.mode,
      pausedAt: null,
      pausedMs: 0,
    },
  };
}

function createSessionId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function remainingFocusMilliseconds(session: UF30ActiveSession, now = Date.now()): number {
  const currentPause = session.pausedAt === null ? 0 : Math.max(0, now - session.pausedAt);
  const elapsed = Math.max(0, now - session.startedAt - session.pausedMs - currentPause);
  return Math.max(0, session.duration * 60_000 - elapsed);
}

export function pauseUF30FocusSession(state: UF30WorkspaceState, now = Date.now()): UF30WorkspaceState {
  if (!state.activeSession || state.activeSession.pausedAt !== null) return state;
  return { ...state, activeSession: { ...state.activeSession, pausedAt: now } };
}

export function resumeUF30FocusSession(state: UF30WorkspaceState, now = Date.now()): UF30WorkspaceState {
  const session = state.activeSession;
  if (!session || session.pausedAt === null) return state;
  return {
    ...state,
    activeSession: {
      ...session,
      pausedMs: session.pausedMs + Math.max(0, now - session.pausedAt),
      pausedAt: null,
    },
  };
}

export function cancelUF30FocusSession(state: UF30WorkspaceState): UF30WorkspaceState {
  return state.activeSession ? { ...state, activeSession: null } : state;
}

export function finishUF30FocusSession(state: UF30WorkspaceState, now = Date.now()): UF30WorkspaceState {
  const active = state.activeSession;
  if (!active) throw new UF30StorageError('There is no focus session to finish.');
  const actualSeconds = Math.max(0, Math.floor((active.duration * 60_000 - remainingFocusMilliseconds(active, now)) / 1000));
  const session: UF30CompletedSession = {
    id: active.id,
    startedAt: active.startedAt,
    finishedAt: now,
    date: localCalendarDate(new Date(active.startedAt)),
    plannedMinutes: active.duration,
    actualSeconds,
    mode: active.mode,
  };
  return { ...state, activeSession: null, sessions: [...state.sessions, session].slice(-MAX_SAVED_SESSIONS) };
}

export function toggleSavedUF30Content(state: UF30WorkspaceState, itemId: string): UF30WorkspaceState {
  if (!itemId.trim()) throw new UF30StorageError('Select published content before saving it.');
  const saved = new Set(state.savedContentIds);
  if (saved.has(itemId)) saved.delete(itemId);
  else saved.add(itemId);
  return { ...state, savedContentIds: [...saved] };
}

export function rateUF30Content(state: UF30WorkspaceState, itemId: string, rating: ContentRating): UF30WorkspaceState {
  if (!itemId.trim() || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new UF30StorageError('Choose an available content item and a rating from one to five.');
  }
  return { ...state, contentRatings: { ...state.contentRatings, [itemId]: rating } };
}

export function getUF30WeekStart(date = new Date()): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function getUF30WeeklyProgress(state: UF30WorkspaceState, date = new Date()) {
  const start = getUF30WeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const weekSessions = state.sessions.filter((session) => {
    const started = new Date(session.startedAt);
    return started >= start && started < end;
  });
  const today = localCalendarDate(date);
  const todaySessions = state.sessions.filter((session) => session.date === today);
  const minutes = (session: UF30CompletedSession) => Math.floor(session.actualSeconds / 60);
  return {
    sessions: weekSessions.length,
    focusMinutes: weekSessions.reduce((total, session) => total + minutes(session), 0),
    todaySessions: todaySessions.length,
    todayFocusMinutes: todaySessions.reduce((total, session) => total + minutes(session), 0),
    todaySchedule: todaySessions,
  };
}
