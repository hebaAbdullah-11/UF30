import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPlanner,
  useCreatePlannerTask,
  useActOnPlannerTask,
  useCapturePlannerIdea,
  useSuggestPlannerTasks,
  useDecidePlannerSuggestions,
  type PlannerTask,
  type PlannerIdea,
} from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, Bell, Check, Clock, Inbox, Play, Plus, RotateCcw, CalendarArrowUp, Wand2, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { dailyCopy } from '@/lib/daily-copy';
import { addDaysLocal, useLocalDate } from '@/lib/local-date';
import { LanguageToggle } from '@/pages/landing';
import { GentleLoader } from '@/components/gentle-loader';

type Copy = (typeof dailyCopy)['en'];

function useCopy() {
  const { lang } = useI18n();
  return { c: dailyCopy[lang] as Copy, lang };
}

function formatDay(day: string, lang: 'ar' | 'en') {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}

function ErrorLine({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <p role="alert" className="mt-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-daily-error">{text}</p>;
}

export default function DailyPage() {
  const { user } = useAuth();
  const { c } = useCopy();
  useEffect(() => {
    const prev = document.title;
    document.title = c.pageTitle;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    const prevContent = meta.content;
    meta.content = c.metaDescription;
    return () => { document.title = prev; if (created) meta?.remove(); else if (meta) meta.content = prevContent; };
  }, [c]);
  if (!user) return <GentleLoader />;
  return <DailyInner key={user.id} userId={user.id} />;
}

function DailyInner({ userId }: { userId: string }) {
  const { c, lang } = useCopy();
  const day = useLocalDate();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['planner', userId] });
  const planner = useGetPlanner({ day }, { query: { queryKey: ['planner', userId, day], enabled: !!userId, refetchInterval: 30000 } });
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const [manualOpen, setManualOpen] = useState(false);
  const snap = planner.data;

  return (
    <div className="min-h-[100dvh] grain" data-testid="page-daily">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-[hsl(var(--card)/.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" data-testid="link-daily-dashboard">
            <Back className="h-4 w-4" />{c.back}
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:py-12">
        <section className="flex min-w-0 flex-col gap-6 soft-reveal">
          <div>
            <p className="font-mono-ui text-[11px] uppercase tracking-[.2em] text-[hsl(var(--accent-foreground))]">{c.eyebrow} · <span data-testid="text-daily-date">{formatDay(day, lang)}</span></p>
            <h1 className="mt-3 text-3xl font-light leading-tight tracking-tight sm:text-4xl">{c.heading}</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{c.sub}</p>
          </div>

          {planner.isLoading ? (
            <div className="space-y-3" data-testid="status-daily-loading">
              {[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : planner.isError || !snap ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm" role="alert">
              <p>{c.loadError}</p>
              <button onClick={() => planner.refetch()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground" data-testid="button-daily-retry"><RotateCcw className="h-3.5 w-3.5" />{c.retry}</button>
            </div>
          ) : (
            <>
              <section aria-label={c.summaryTitle}>
              <h2 className="mb-3 text-sm font-medium">{c.summaryTitle}</h2>
              <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card" data-testid="summary-daily">
                {([['completed', c.summaryCompleted], ['deferred', c.summaryDeferred], ['remaining', c.summaryRemaining]] as const).map(([k, label], i) => (
                  <div key={k} className={`px-4 py-4 ${i ? 'border-s border-border' : ''}`}>
                    <p className="font-mono-ui text-2xl text-primary" data-testid={`text-summary-${k}`}>{snap[k]}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              </section>

              <div>
                <h2 className="mb-3 font-mono-ui text-[11px] uppercase tracking-[.2em] text-muted-foreground">{c.dueTitle}</h2>
                {snap.tasks.length === 0 && !snap.exercise ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground" data-testid="status-daily-empty">{c.emptyDue}</div>
                ) : (
                  <ol className="space-y-3">
                    {snap.tasks.slice(0, 3).map((task, i) => <TaskRow key={task.id} task={task} index={i + 1} day={day} onDone={refresh} />)}
                    {snap.exercise && <TaskRow task={snap.exercise} day={day} onDone={refresh} exercise />}
                  </ol>
                )}
                {snap.remaining > snap.tasks.length && <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="text-daily-remaining">{c.remainingNote(snap.remaining - snap.tasks.length)}</p>}
              </div>

              <AddTaskForm day={day} onDone={refresh} open={manualOpen} setOpen={setManualOpen} />

              <div>
                <h2 className="mb-3 font-mono-ui text-[11px] uppercase tracking-[.2em] text-muted-foreground">{c.upcoming}</h2>
                {snap.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">{c.upcomingEmpty}</p> : (
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card" data-testid="list-upcoming">
                    {snap.upcoming.map(t => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm" data-testid={`row-upcoming-${t.id}`}>
                        <span className="w-24 shrink-0 font-mono-ui text-xs text-muted-foreground">{formatDay(t.scheduledDay, lang)}</span>
                        {t.kind === 'reminder' && <Bell className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--chart-4))]" />}
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {t.reminderTime && <span className="font-mono-ui text-xs text-muted-foreground" dir="ltr">{t.reminderTime}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        <IdeaInbox ideas={snap?.ideas ?? []} loading={planner.isLoading} day={day} onDone={refresh} openManual={() => setManualOpen(true)} />
      </main>
    </div>
  );
}

function TaskRow({ task, index, day, onDone, exercise }: { task: PlannerTask; index?: number; day: string; onDone: () => void; exercise?: boolean }) {
  const { c, lang } = useCopy();
  const act = useActOnPlannerTask();
  const [deferOpen, setDeferOpen] = useState(false);
  const [deferDay, setDeferDay] = useState(addDaysLocal(day, 1));
  const [confirm, setConfirm] = useState<string | null>(null);
  const isActive = task.status === 'active';

  const run = (action: 'start' | 'done' | 'defer', deferUntil?: string) => {
    act.mutate({ id: task.id, data: { action, day, ...(deferUntil ? { deferUntil } : {}) } }, {
      onSuccess: () => {
        if (action === 'defer') { setDeferOpen(false); setConfirm(deferUntil ?? addDaysLocal(day, 1)); }
        onDone();
      },
    });
  };
  const btn = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition disabled:opacity-50';

  return (
    <li className={`rounded-2xl border bg-card p-4 transition ${isActive ? 'border-primary/50 shadow-md ring-1 ring-primary/20' : 'border-border'}`} data-testid={`card-task-${task.id}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono-ui text-sm ${exercise ? 'bg-[hsl(var(--accent)/.3)] text-[hsl(var(--accent-foreground))]' : isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
          {exercise ? <Activity className="h-4 w-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] leading-snug" data-testid={`text-task-title-${task.id}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{exercise ? c.exercise : task.kind === 'reminder' ? c.reminder : c.task}</span>
            {task.reminderTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /><span dir="ltr">{task.reminderTime}</span></span>}
            {isActive && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary" data-testid={`status-task-active-${task.id}`}>{c.active}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 ps-11">
        {!isActive && <button disabled={act.isPending} onClick={() => run('start')} className={`${btn} bg-secondary text-secondary-foreground hover:bg-secondary/70`} data-testid={`button-start-${task.id}`}><Play className="h-3 w-3" />{c.start}</button>}
        <button disabled={act.isPending} onClick={() => run('done')} className={`${btn} bg-primary text-primary-foreground hover:opacity-90`} data-testid={`button-done-${task.id}`}><Check className="h-3 w-3" />{c.done}</button>
        <button disabled={act.isPending} onClick={() => setDeferOpen(o => !o)} className={`${btn} border border-border hover:bg-muted`} data-testid={`button-defer-${task.id}`}><CalendarArrowUp className="h-3 w-3" />{c.defer}</button>
      </div>
      {deferOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3 ms-11">
          <button disabled={act.isPending} onClick={() => run('defer')} className={`${btn} bg-card border border-border`} data-testid={`button-defer-tomorrow-${task.id}`}>{c.tomorrow}</button>
          <span className="text-xs text-muted-foreground">{c.pickDay}</span>
          <input type="date" min={addDaysLocal(day, 1)} value={deferDay} onChange={e => setDeferDay(e.target.value)} className="rounded-lg border border-input bg-card px-2 py-1 text-xs" data-testid={`input-defer-day-${task.id}`} />
          <button disabled={act.isPending || !deferDay || deferDay <= day} onClick={() => run('defer', deferDay)} className={`${btn} bg-primary text-primary-foreground`} data-testid={`button-defer-confirm-${task.id}`}>{c.confirmDefer}</button>
          <button onClick={() => setDeferOpen(false)} className={`${btn} text-muted-foreground`} data-testid={`button-defer-cancel-${task.id}`}>{c.cancel}</button>
        </div>
      )}
      {confirm && <p className="mt-2 ps-11 text-xs text-muted-foreground" role="status">{c.deferredTo(formatDay(confirm, lang))}</p>}
      <ErrorLine show={act.isError} text={c.error} />
    </li>
  );
}

function AddTaskForm({ day, onDone, open, setOpen }: { day: string; onDone: () => void; open: boolean; setOpen: (v: boolean) => void }) {
  const { c } = useCopy();
  const create = useCreatePlannerTask();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'task' | 'reminder'>('task');
  const [scheduledDay, setScheduledDay] = useState(day);
  const [time, setTime] = useState('');
  useEffect(() => { setScheduledDay(d => (d < day ? day : d)); }, [day]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ data: { title: title.trim(), kind, scheduledDay, reminderTime: time || null } }, {
      onSuccess: () => { setTitle(''); setTime(''); setKind('task'); setScheduledDay(day); onDone(); },
    });
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/5" data-testid="button-open-add-task"><Plus className="h-4 w-4" />{c.addTitle}</button>
  );
  const field = 'rounded-xl border border-input bg-background px-3 py-2 text-sm';
  return (
    <form onSubmit={submit} id="add-task" className="rounded-2xl border border-border bg-card p-4" data-testid="form-add-task">
      {/* The form opens on an explicit "add" tap, so moving focus into it is expected. */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus aria-label={c.addTitlePlaceholder} required value={title} maxLength={240} onChange={e => setTitle(e.target.value)} placeholder={c.addTitlePlaceholder} className={`${field} w-full`} data-testid="input-task-title" />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex rounded-full bg-muted p-1" role="radiogroup" aria-label={c.kindLabel}>
          {(['task', 'reminder'] as const).map(k => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs ${kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`} data-testid={`button-kind-${k}`}>{k === 'task' ? c.task : c.reminder}</button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">{c.dayLabel}<input required type="date" min={day} value={scheduledDay} onChange={e => setScheduledDay(e.target.value)} className={field} data-testid="input-task-day" /></label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">{kind === 'reminder' ? c.requiredTimeLabel : c.timeLabel}<input required={kind === 'reminder'} type="time" value={time} onChange={e => setTime(e.target.value)} className={field} data-testid="input-task-time" /></label>
      </div>
      {kind === 'reminder' && <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><Bell className="h-3.5 w-3.5 shrink-0" />{c.reminderNote}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={create.isPending || !title.trim() || !scheduledDay} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50" data-testid="button-save-task">{create.isPending ? c.adding : c.add}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-muted-foreground" data-testid="button-cancel-task">{c.cancel}</button>
      </div>
      <ErrorLine show={create.isError} text={c.error} />
    </form>
  );
}

function IdeaInbox({ ideas, loading, day, onDone, openManual }: { ideas: PlannerIdea[]; loading: boolean; day: string; onDone: () => void; openManual: () => void }) {
  const { c } = useCopy();
  const capture = useCapturePlannerIdea();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    capture.mutate({ data: { text: text.trim() } }, { onSuccess: () => { setText(''); onDone(); } });
  };
  return (
    <aside className="min-w-0 soft-reveal-delay lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-[1.75rem] border border-border bg-[hsl(var(--secondary)/.45)] p-5 sm:p-6">
        <div className="flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /><h2 className="text-lg font-medium">{c.inboxTitle}</h2></div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.inboxSub}</p>
        <form onSubmit={submit} className="mt-4">
          <textarea aria-label={c.ideaPlaceholder} value={text} maxLength={6000} onChange={e => setText(e.target.value)} rows={4} placeholder={c.ideaPlaceholder} className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-sm leading-relaxed" data-testid="input-idea" />
          <button type="submit" disabled={capture.isPending || !text.trim()} className="mt-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50" data-testid="button-capture-idea">{capture.isPending ? c.capturing : c.capture}</button>
          <ErrorLine show={capture.isError} text={c.error} />
        </form>
        <div className="mt-6 space-y-3">
          {loading ? <div className="h-24 animate-pulse rounded-2xl bg-card/70" /> :
            ideas.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground" data-testid="status-inbox-empty">{c.inboxEmpty}</p> :
            ideas.map(idea => <IdeaCard key={idea.id} idea={idea} day={day} onDone={onDone} openManual={openManual} />)}
        </div>
      </div>
    </aside>
  );
}

function IdeaCard({ idea, day, onDone, openManual }: { idea: PlannerIdea; day: string; onDone: () => void; openManual: () => void }) {
  const { c, lang } = useCopy();
  const suggest = useSuggestPlannerTasks();
  const decide = useDecidePlannerSuggestions();
  const [selected, setSelected] = useState<string[]>([]);
  const err = suggest.error as { status?: number } | null;
  const unavailable = suggest.isError && err?.status === 503;
  const selectable = idea.suggestions.filter(s => s.decision !== 'approved');
  const busy = decide.isPending;

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const runSuggest = () => suggest.mutate({ id: idea.id, data: { language: lang } }, { onSuccess: () => onDone() });
  const runDecide = (mode: 'approve' | 'reject') => {
    if (!selected.length) return;
    decide.mutate({ id: idea.id, data: { approvedIds: mode === 'approve' ? selected : [], rejectedIds: mode === 'reject' ? selected : [], day } }, {
      onSuccess: () => { setSelected([]); onDone(); },
    });
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4" data-testid={`card-idea-${idea.id}`}>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{idea.text}</p>
      {idea.suggestions.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[11px] text-muted-foreground">{c.selectHint}</p>
          <ul className="space-y-1.5">
            {idea.suggestions.map(s => {
              const can = s.decision !== 'approved';
              return (
                <li key={s.id}>
                  <label className={`flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-sm ${can ? 'cursor-pointer hover:bg-muted/60' : 'opacity-70'}`}>
                    {can ? <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} disabled={busy} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-suggestion-${s.id}`} /> : <Check className="mt-0.5 h-4 w-4 text-primary" />}
                    <span className={`min-w-0 flex-1 break-words ${s.decision === 'rejected' ? 'text-muted-foreground' : ''}`}>{s.title}</span>
                    <span className="shrink-0 font-mono-ui text-[10px] text-muted-foreground">{s.decision === 'approved' ? c.approved : s.decision === 'rejected' ? c.rejected : c.pendingLbl}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {selectable.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy || !selected.length} onClick={() => runDecide('approve')} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50" data-testid={`button-approve-${idea.id}`}>{busy ? c.deciding : c.approveSelected}</button>
              <button disabled={busy || !selected.length} onClick={() => runDecide('reject')} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50" data-testid={`button-reject-${idea.id}`}>{c.rejectSelected}</button>
            </div>
          )}
          <ErrorLine show={decide.isError} text={c.error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={suggest.isPending} onClick={runSuggest} className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent)/.35)] px-3 py-1.5 text-xs text-[hsl(var(--accent-foreground))] disabled:opacity-50" data-testid={`button-suggest-${idea.id}`}>
          {suggest.isError ? <RotateCcw className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
          {suggest.isPending ? c.suggesting : suggest.isError ? c.retry : c.suggest}
        </button>
      </div>
      {suggest.isError && (
        <div role="alert" className="mt-2 rounded-xl bg-muted/70 p-3 text-xs leading-relaxed" data-testid={`status-suggest-error-${idea.id}`}>
          <p>{unavailable ? c.aiUnavailable : c.error}</p>
          <button onClick={() => { openManual(); setTimeout(() => document.getElementById('add-task')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} className="mt-2 underline underline-offset-4" data-testid={`button-manual-${idea.id}`}>{c.manualTask}</button>
        </div>
      )}
    </article>
  );
}
