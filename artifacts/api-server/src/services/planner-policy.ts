export type Proposal = { id: string; title: string; decision: "pending" | "approved" | "rejected" };
export type Task = {
  id: string; title: string; kind: "task" | "reminder" | "exercise";
  status: "pending" | "active" | "done"; scheduledDay: string;
  reminderTime: string | null; completedDay: string | null; deferredOn: string | null;
};

export function isCalendarDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
}

export function nextDay(day: string) {
  if (!isCalendarDay(day)) throw new Error("Invalid day");
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function taskAction(task: Task, action: "start" | "done" | "defer", day: string, deferUntil?: string) {
  if (!isCalendarDay(day)) throw new Error("Invalid day");
  if (task.status === "done") return {};
  if (action === "start") return { status: "active" as const };
  if (action === "done") return { status: "done" as const, completedDay: day };
  const scheduledDay = deferUntil ?? nextDay(day);
  if (!isCalendarDay(scheduledDay) || scheduledDay <= day) throw new Error("Choose a future day");
  return { status: "pending" as const, scheduledDay, reminderTime: task.reminderTime ?? "09:00", deferredOn: day };
}

/** No implicit approval: only the explicit IDs can produce tasks. Replays create nothing. */
export function decideProposals(proposals: Proposal[], approvedIds: string[], rejectedIds: string[]) {
  const approve = new Set(approvedIds), reject = new Set(rejectedIds);
  const known = new Set(proposals.map(p => p.id));
  if ([...approve, ...reject].some(id => !known.has(id)) || [...approve].some(id => reject.has(id))) {
    throw new Error("Invalid selection");
  }
  const newlyApproved: Proposal[] = [];
  const suggestions = proposals.map(proposal => {
    if (proposal.decision === "approved") return proposal;
    if (approve.has(proposal.id)) {
      newlyApproved.push(proposal);
      return { ...proposal, decision: "approved" as const };
    }
    if (reject.has(proposal.id)) return { ...proposal, decision: "rejected" as const };
    return proposal;
  });
  return { suggestions, newlyApproved };
}

export function projectDay(tasks: Task[], day: string) {
  const due = tasks.filter(t => t.status !== "done" && t.scheduledDay <= day);
  const ordinary = due.filter(t => t.kind !== "exercise");
  return {
    tasks: ordinary.slice(0, 3),
    exercise: due.find(t => t.kind === "exercise") ?? null,
    upcoming: tasks.filter(t => t.status !== "done" && t.scheduledDay > day),
    remaining: ordinary.length,
    completed: tasks.filter(t => t.completedDay === day).length,
    deferred: tasks.filter(t => t.deferredOn === day).length,
  };
}
