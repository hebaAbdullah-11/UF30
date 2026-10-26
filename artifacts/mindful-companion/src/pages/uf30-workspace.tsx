import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, LockKeyhole, ShieldCheck, Sparkles, Star, Timer, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { uf30Copy, type UF30CopyKey } from '@/lib/uf30-copy';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UF30_DISCOVERY_ITEMS } from '@/lib/uf30-discovery-content';
import {
  cancelUF30FocusSession, clearUF30WorkspaceData, createEmptyUF30Workspace, finishUF30FocusSession,
  getUF30WeeklyProgress, isUF30ReminderDue, localCalendarDate, pauseUF30FocusSession,
  rateUF30Content, readUF30Workspace, remainingFocusMilliseconds, resumeUF30FocusSession,
  startUF30FocusSession, subscribeUF30Workspace, toggleSavedUF30Content, updateUF30Workspace,
  type ContentKind, type ContentRating, type FocusMinutes,
  type UF30WorkspacePage, type UF30WorkspaceState,
} from '@/lib/uf30-workspace-data';
import './uf30.css';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const dayKeys: UF30CopyKey[] = ['wsSunday', 'wsMonday', 'wsTuesday', 'wsWednesday', 'wsThursday', 'wsFriday', 'wsSaturday'];
const itemIcons: Record<ContentKind, typeof BookOpen> = { podcast: Headphones, article: BookOpen, exercise: Sparkles };
const minuteChoices: FocusMinutes[] = [15, 25, 45];

export default function UF30Workspace({ page }: { page: UF30WorkspacePage }) {
  const { lang, setLang } = useI18n();
  const ar = lang === 'ar';
  const t = useCallback((key: UF30CopyKey) => uf30Copy[lang][key], [lang]);
  const initialReadFailed = useRef(false);
  const [state, setState] = useState<UF30WorkspaceState>(() => {
    try { return readUF30Workspace(); } catch { initialReadFailed.current = true; return createEmptyUF30Workspace(); }
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [storageError, setStorageError] = useState(initialReadFailed.current);
  const [remaining, setRemaining] = useState(() => state.activeSession ? remainingFocusMilliseconds(state.activeSession) : 0);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<'all' | ContentKind>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const finishing = useRef(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeUF30Workspace(() => {
    try {
      const fresh = readUF30Workspace();
      setState(fresh);
      setStorageError(false);
    } catch { setStorageError(true); }
  }), []);

  const commit = (change: (current: UF30WorkspaceState) => UF30WorkspaceState) => {
    try {
      const next = updateUF30Workspace(change);
      setState(next);
      setStorageError(false);
      return true;
    } catch { setStorageError(true); return false; }
  };

  useEffect(() => {
    if (!state.activeSession) { setRemaining(0); return; }
    const tick = () => {
      const active = stateRef.current.activeSession;
      if (!active) return;
      const timeLeft = remainingFocusMilliseconds(active);
      setRemaining(timeLeft);
      if (timeLeft <= 0 && !finishing.current) {
        finishing.current = true;
        try {
          const next = updateUF30Workspace((current) => finishUF30FocusSession(current));
          setState(next);
          setStatus(t('wsDone'));
          setStorageError(false);
        } catch { setStorageError(true); }
        finishing.current = false;
      }
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [state.activeSession?.id, state.activeSession?.pausedAt, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isUF30ReminderDue(state, new Date(now))) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification('UF30', { body: t('wsReminderDue'), tag: 'uf30-reminder' });
      commit((current) => ({ ...current, lastReminderNoticeDate: localCalendarDate(new Date(now)) }));
    } catch { /* Notification can be blocked by browser or operating system. */ }
  }, [now, state.settings.remindersEnabled, state.settings.reminderTime, state.settings.reminderDays, state.lastReminderNoticeDate, t]);

  const weekly = getUF30WeeklyProgress(state, new Date(now));
  const navItems: { path: string; id: UF30WorkspacePage; label: UF30CopyKey }[] = [
    { path: '/uf30/focus', id: 'focus', label: 'wsFocus' },
    { path: '/uf30/discover', id: 'discover', label: 'wsDiscover' },
    { path: '/uf30/me', id: 'me', label: 'wsMe' },
  ];
  const setSetting = <K extends keyof UF30WorkspaceState['settings']>(key: K, value: UF30WorkspaceState['settings'][K]) => {
    commit((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  };
  const retryStorage = () => {
    try { const fresh = readUF30Workspace(); setState(fresh); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const startSession = () => {
    if (commit((current) => startUF30FocusSession(current))) setStatus(t('wsRunning'));
  };
  const endAndLog = () => {
    if (commit((current) => finishUF30FocusSession(current))) setStatus(t('wsEnded'));
  };
  const cancelSession = () => {
    if (commit((current) => cancelUF30FocusSession(current))) setStatus(t('wsCanceled'));
  };
  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') { setStatus(t('wsReminderUnsupported')); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSetting('remindersEnabled', true);
        setStatus(t('wsReminderGranted'));
      } else if (permission === 'denied') setStatus(t('wsReminderDenied'));
      else setStatus(t('wsPermissionNeeded'));
    } catch { setStatus(t('wsReminderUnsupported')); }
  };
  const removeAll = () => {
    try {
      clearUF30WorkspaceData();
      const empty = createEmptyUF30Workspace();
      setState(empty);
      setConfirmDelete(false);
      setStorageError(false);
      setStatus(t('wsDeleted'));
    } catch { setStorageError(true); }
  };
  const shownItems = UF30_DISCOVERY_ITEMS.filter((item) => filter === 'all' || item.kind === filter);
  const selectedContent = UF30_DISCOVERY_ITEMS.filter((item) => state.savedContentIds.includes(item.id));
  const displayedItems = page === 'me' ? selectedContent : shownItems;
  const seconds = Math.ceil(remaining / 1000);
  const timerText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const titleKey = page === 'focus' ? 'wsFocusTitle' : page === 'discover' ? 'wsDiscoverTitle' : 'wsMeTitle';
  const bodyKey = page === 'focus' ? 'wsFocusBody' : page === 'discover' ? 'wsDiscoverBody' : 'wsMeBody';

  return <main className="uf30" dir={ar ? 'rtl' : 'ltr'} data-testid={`page-uf30-${page}`}>
    <div className="uf-workspace">
      <header className="uf-workspace-header">
        <Link href="/" className="uf-brand" aria-label="UF30">
          <span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{t('footer')}</small></span>
        </Link>
        <nav className="uf-workspace-nav" aria-label={ar ? 'مساحة UF30' : 'UF30 workspace navigation'}>
          {navItems.map((item) => <Link key={item.id} href={item.path} aria-current={page === item.id ? 'page' : undefined}>{t(item.label)}</Link>)}
          <Link href="/uf30/afta" data-testid="link-workspace-afta">{ar ? 'أفتا' : 'AFTA'}</Link>
        </nav>
        <div className="uf-actions">
          <button className="uf-lang" onClick={() => setLang(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'عربي'}</button>
          <Link href="/" className="uf-back-link">{ar ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>} {t('wsBack')}</Link>
        </div>
      </header>

      <div className="uf-workspace-heading">
        <span className="uf-eyebrow"><i/> UF30 · {t(page === 'focus' ? 'wsFocus' : page === 'discover' ? 'wsDiscover' : 'wsMe')}</span>
        <h1>{t(titleKey)}</h1><p>{t(bodyKey)}</p>
      </div>

      {storageError && <div className="uf-storage-error" role="alert">
        <strong>{t('wsErrorTitle')}</strong><br/>{t('wsErrorBody')} <button className="uf-button ghost" onClick={retryStorage} style={{marginInlineStart:10}}>{t('wsRetry')}</button>
      </div>}

      {page === 'focus' && <section className="uf-workspace-grid" aria-label={t('wsFocusTitle')}>
        <div className="uf-panel">
          <span className="uf-kicker">{t('wsDuration')}</span>
          <div className="uf-segmented" role="group" aria-label={t('wsDuration')}>
            {minuteChoices.map((minutes) => <button key={minutes} className="uf-choice" disabled={!!state.activeSession} aria-pressed={state.settings.duration === minutes} onClick={() => setSetting('duration', minutes)}>{minutes} {ar ? 'دقيقة' : 'min'}</button>)}
          </div>
          <span className="uf-kicker">{t('wsMode')}</span>
          <div className="uf-segmented two" role="group" aria-label={t('wsMode')}>
            <button className="uf-choice" disabled={!!state.activeSession} aria-pressed={state.settings.mode === 'solo'} onClick={() => setSetting('mode', 'solo')}>{t('wsSolo')}</button>
            <button className="uf-choice" disabled={!!state.activeSession} aria-pressed={state.settings.mode === 'companion'} onClick={() => setSetting('mode', 'companion')}>{t('wsCompanion')}</button>
          </div>
          <div className="uf-timer-face" aria-label={t(state.activeSession?.pausedAt !== null && state.activeSession ? 'wsPaused' : state.activeSession ? 'wsRunning' : 'wsReady')}>
            <span className="uf-timer-value" aria-live="off" data-testid="text-focus-timer">{state.activeSession ? timerText : `${String(state.settings.duration).padStart(2, '0')}:00`}</span>
          </div>
          <p className="uf-timer-caption">{state.activeSession ? t(state.activeSession.pausedAt === null ? 'wsRunning' : 'wsPaused') : t('wsReady')}</p>
          <div className="uf-focus-controls">
            {!state.activeSession ? <button className="uf-button" onClick={startSession}><Timer size={17}/>{t('wsStart')}</button> : <>
              {state.activeSession.pausedAt === null
                ? <button className="uf-button secondary" onClick={() => { if (commit((current) => pauseUF30FocusSession(current))) setStatus(t('wsPaused')); }}>{t('wsPause')}</button>
                : <button className="uf-button" onClick={() => { if (commit((current) => resumeUF30FocusSession(current))) setStatus(t('wsRunning')); }}>{t('wsResume')}</button>}
              <button className="uf-button" onClick={endAndLog}><Check size={16}/>{t('wsEnd')}</button>
              <button className="uf-button ghost" onClick={cancelSession}>{t('wsCancel')}</button>
            </>}
          </div>
          <p className="uf-inline-status" aria-live="polite" role="status">{status}</p>
        </div>
        <aside className="uf-panel">
          <span className="uf-kicker">{t('wsProgress')}</span><h2>{t('wsFocusSide')}</h2><p>{t('wsFocusSideBody')}</p>
          <div className="uf-mini-stats">
            <div className="uf-stat-line"><span>{t('wsSessions')}</span><strong>{weekly.sessions}</strong></div>
            <div className="uf-stat-line"><span>{t('wsMinutes')}</span><strong>{weekly.focusMinutes}</strong></div>
          </div>
          <p style={{marginTop:16,fontSize:12}}>{t('wsWeekNote')}</p>
        </aside>
      </section>}

      {page === 'discover' && <section>
        <div className="uf-content-filter" role="group" aria-label={t('wsDiscoverTitle')}>
          {(['all', 'podcast', 'article', 'exercise'] as const).map((kind) => {
            const label = kind === 'all' ? 'wsAll' : kind === 'podcast' ? 'wsPodcast' : kind === 'article' ? 'wsArticle' : 'wsExercise';
            return <button key={kind} className="uf-choice" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{t(label)}</button>;
          })}
          <Link href="/uf30/me" className="uf-choice">{t('wsSaved')}: {state.savedContentIds.length}</Link>
        </div>
        {displayedItems.length === 0 ? <div className="uf-empty-editorial" role="status" data-testid="status-uf30-editorial-empty">
          <span className="uf-empty-mark"><BookOpen size={23}/></span><h2>{t('wsEditorialTitle')}</h2><p>{t('wsEditorialBody')}</p>
        </div> : <div className="uf-workspace-grid">{displayedItems.map((item) => {
          const Icon = itemIcons[item.kind];
          const saved = state.savedContentIds.includes(item.id);
          const rating = state.contentRatings[item.id] ?? 0;
          return <article className="uf-content-card" key={item.id}>
            <span className="uf-kicker"><Icon size={14}/> {t(item.kind === 'podcast' ? 'wsPodcast' : item.kind === 'article' ? 'wsArticle' : 'wsExercise')}</span>
            <h2>{item.title}</h2><p>{item.description}</p><p>{item.sourceName}</p>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName}</a>}
             <button className="uf-button secondary" onClick={() => { if (commit((current) => toggleSavedUF30Content(current, item.id))) setStatus(t(saved ? 'wsContentRemoved' : 'wsContentSaved')); }}>{saved ? t('wsUnsave') : t('wsSave')}</button>
             <div className="uf-rating" role="group" aria-label={t('wsRate')}>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} / 5`} aria-pressed={rating === value} onClick={() => { if (commit((current) => rateUF30Content(current, item.id, value as ContentRating))) setStatus(t('wsRatingSaved')); }}><Star size={18} fill={rating >= value ? 'currentColor' : 'none'}/></button>)}</div>
          </article>;
        })}</div>}
        <p className="uf-inline-status" aria-live="polite">{status}</p>
      </section>}

      {page === 'me' && <div className="uf-workspace-grid">
        <section className="uf-panel">
          <span className="uf-kicker">{t('wsProgress')}</span><h2>{t('wsProgress')}</h2>
          <div className="uf-mini-stats">
            <div className="uf-stat-line"><span>{t('wsSessions')}</span><strong>{weekly.sessions}</strong></div>
            <div className="uf-stat-line"><span>{t('wsMinutes')}</span><strong>{weekly.focusMinutes}</strong></div>
            <div className="uf-stat-line"><span>{t('wsTodayTotal')}</span><strong>{weekly.todayFocusMinutes} {ar ? 'د' : 'min'}</strong></div>
          </div>
          <h2 style={{marginTop:28}}>{t('wsToday')}</h2>
          {weekly.todaySchedule.length === 0 ? <p>{t('wsNoSessions')}</p> : <ul className="uf-log-list">{weekly.todaySchedule.map((session, index) => <li key={session.id}><strong>{t('wsSession')} {index + 1} · {session.plannedMinutes} {ar ? 'دقيقة' : 'min'} · {session.mode === 'solo' ? t('wsSolo') : t('wsCompanion')}</strong><small>{Math.floor(session.actualSeconds / 60)} {ar ? 'دقيقة فعلية' : 'min focused'} · {new Date(session.startedAt).toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</small></li>)}</ul>}
          <p style={{marginTop:16,fontSize:12}}>{t('wsWeekNote')}</p>
          <h2 style={{marginTop:28}}>{t('wsSaved')}</h2>
           {selectedContent.length === 0 ? <p>{t('wsNoSaved')}</p> : <ul className="uf-log-list">{selectedContent.map((item) => <li key={item.id}><strong>{item.title}</strong><button className="uf-button ghost" onClick={() => { if (commit((current) => toggleSavedUF30Content(current, item.id))) setStatus(t('wsContentRemoved')); }}>{t('wsUnsave')}</button></li>)}</ul>}
        </section>
        <section className="uf-panel">
          <span className="uf-kicker">{t('wsPreferences')}</span><h2>{t('wsPreferences')}</h2>
          <label className="uf-field">{t('wsDefaultDuration')}<select value={state.settings.duration} onChange={(event) => setSetting('duration', Number(event.target.value) as FocusMinutes)}>{minuteChoices.map((value) => <option key={value} value={value}>{value} {ar ? 'دقيقة' : 'minutes'}</option>)}</select></label>
          <label className="uf-field">{t('wsDefaultMode')}<select value={state.settings.mode} onChange={(event) => setSetting('mode', event.target.value as 'solo' | 'companion')}><option value="solo">{t('wsSolo')}</option><option value="companion">{t('wsCompanion')}</option></select></label>
          <h2 style={{marginTop:25}}>{t('wsReminder')}</h2>
            <label className="uf-check-row"><input type="checkbox" checked={state.settings.remindersEnabled} onChange={(event) => {
              if (!event.target.checked) { setSetting('remindersEnabled', false); return; }
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') setSetting('remindersEnabled', true);
              else void requestNotifications();
            }}/><span>{t('wsReminderEnable')}</span></label>
          <label className="uf-field">{t('wsReminderTime')}<input type="time" value={state.settings.reminderTime} onChange={(event) => setSetting('reminderTime', event.target.value)}/></label>
          <fieldset style={{border:0,padding:0,margin:'18px 0'}}><legend className="uf-field" style={{display:'block'}}>{t('wsReminderDays')}</legend><div className="uf-day-picks">{DAYS.map((day) => <label key={day}><input type="checkbox" checked={state.settings.reminderDays.includes(day)} onChange={(event) => setSetting('reminderDays', event.target.checked ? [...new Set([...state.settings.reminderDays, day])].sort() : state.settings.reminderDays.filter((value) => value !== day))}/>{t(dayKeys[day])}</label>)}</div></fieldset>
          <button className="uf-button secondary" onClick={requestNotifications}>{t('wsReminderAction')}</button>
          <p className="uf-inline-status" role="status" aria-live="polite">{typeof Notification === 'undefined' ? t('wsReminderUnsupported') : Notification.permission === 'denied' ? t('wsReminderDenied') : Notification.permission === 'granted' && state.settings.remindersEnabled ? t('wsReminderGranted') : state.settings.remindersEnabled ? t('wsPermissionNeeded') : t('wsReminderOff')}</p>
          <p style={{fontSize:12,color:'var(--u-muted)',lineHeight:1.7}}>{t('wsReminderClosed')}</p>
        </section>

        <section className="uf-panel">
          <span className="uf-kicker">{t('wsStorageTitle')}</span><h2>{t('wsStorageTitle')}</h2>
          <div className="uf-storage-note"><LockKeyhole size={18}/><span>{t('wsStorageBody')}</span></div>
          <h2 style={{marginTop:22}}>{t('wsPrivacyTitle')}</h2><p>{t('wsPrivacyBody')}</p>
        </section>
        <section className="uf-panel uf-danger-zone">
          <span className="uf-kicker">{t('wsPrivacyTitle')}</span><h2>{t('wsDeleteTitle')}</h2><p>{t('wsDeleteBody')}</p>
          <button className="uf-button danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16}/>{t('wsDelete')}</button>
        </section>
      </div>}

      <footer className="uf-footer" style={{marginTop:45,borderRadius:18,padding:'22px 25px'}}>
        <div className="uf-footer-row"><div className="uf-brand"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{t('footer')}</small></span></div><small><ShieldCheck size={14} style={{verticalAlign:'middle',marginInlineEnd:6}}/>{t('wsStorageBody')}</small><Link href="/" className="uf-back-link">{t('wsBack')}</Link></div>
      </footer>
    </div>
     <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
       <AlertDialogContent className="uf30 uf-confirm-dialog" dir={ar ? 'rtl' : 'ltr'}>
         <AlertDialogHeader>
           <AlertDialogTitle>{t('wsDeleteTitle')}</AlertDialogTitle>
           <AlertDialogDescription>{t('wsDeleteBody')}</AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter className="uf-dialog-actions">
           <AlertDialogCancel className="uf-button ghost">{t('wsKeepData')}</AlertDialogCancel>
           <button type="button" className="uf-button danger" onClick={removeAll}>{t('wsConfirmDelete')}</button>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
  </main>;
}
