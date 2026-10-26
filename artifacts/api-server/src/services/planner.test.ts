import assert from "node:assert/strict";
import test from "node:test";
import { decideProposals, isCalendarDay, nextDay, projectDay, taskAction, type Task } from "./planner-policy.ts";
import { createPlannerSuggester } from "./planner-suggestions.ts";

const day = "2026-10-26";
const makeTask = (id: string, changes: Partial<Task> = {}): Task => ({
  id, title: id, kind: "task", status: "pending", scheduledDay: day,
  reminderTime: null, completedDay: null, deferredOn: null, ...changes,
});
const proposals = [
  { id: "one", title: "Open notebook", decision: "pending" as const },
  { id: "two", title: "Write a line", decision: "pending" as const },
  { id: "three", title: "Close notebook", decision: "pending" as const },
];

test("only explicit approval creates tasks, rejection and unchecked ideas remain", () => {
  const none = decideProposals(proposals, [], []);
  assert.equal(none.newlyApproved.length, 0);
  const result = decideProposals(proposals, ["one"], ["two"]);
  assert.deepEqual(result.newlyApproved.map(p => p.id), ["one"]);
  assert.deepEqual(result.suggestions.map(p => p.decision), ["approved", "rejected", "pending"]);
  assert.equal(decideProposals(result.suggestions, ["one"], []).newlyApproved.length, 0);
  assert.equal(decideProposals(result.suggestions, ["two"], []).newlyApproved.length, 1);
  assert.equal(proposals[0].decision, "pending", "does not mutate inbox input");
});
test("unknown or conflicting approvals rejected atomically", () => {
  assert.throws(() => decideProposals(proposals, ["foreign"], []));
  assert.throws(() => decideProposals(proposals, ["one"], ["one"]));
  assert.equal(decideProposals(proposals, ["one", "one"], []).newlyApproved.length, 1);
});
test("daily plan shows at most three plus actual program exercise, not invented content", () => {
  const tasks = Array.from({ length: 5 }, (_, i) => makeTask(String(i)));
  assert.equal(projectDay(tasks, day).tasks.length, 3);
  assert.equal(projectDay(tasks, day).remaining, 5);
  assert.equal(projectDay(tasks, day).exercise, null);
  const exercise = makeTask("exercise", { kind: "exercise" });
  assert.equal(projectDay([...tasks, exercise], day).exercise?.id, "exercise");
});
test("start, completion and deferral update projection, summary and next suggestion", () => {
  const one = makeTask("one"), two = makeTask("two");
  const active = { ...one, ...taskAction(one, "start", day) };
  assert.equal(active.status, "active");
  const done = { ...active, ...taskAction(active, "done", day) };
  const later = { ...two, ...taskAction(two, "defer", day) };
  const snapshot = projectDay([done, later], day);
  assert.equal(snapshot.completed, 1);
  assert.equal(snapshot.deferred, 1);
  assert.equal(snapshot.remaining, 0);
  assert.equal(snapshot.upcoming[0].scheduledDay, "2026-10-27");
  assert.equal(snapshot.upcoming[0].reminderTime, "09:00");
  assert.equal(projectDay([later], "2026-10-27").tasks.length, 1);
  assert.deepEqual(taskAction(done, "defer", day), {});
});
test("custom future deferral preserves reminder; invalid real dates rejected", () => {
  const reminder = makeTask("remind", { kind: "reminder", reminderTime: "15:30" });
  assert.equal(taskAction(reminder, "defer", day, "2026-11-01").reminderTime, "15:30");
  assert.throws(() => taskAction(reminder, "defer", day, day));
  assert.throws(() => taskAction(reminder, "defer", day, "2026-02-30"));
  assert.equal(isCalendarDay("2026-02-29"), false);
  assert.equal(isCalendarDay("2028-02-29"), true);
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
});
test("AI provider is replaceable and sees only the supplied idea, requested language and instructions", async () => {
  for (const language of ["ar", "en"] as const) {
    const suggest = createPlannerSuggester(async input => {
      assert.deepEqual(Object.keys(input).sort(), ["instructions", "language", "text"]);
      assert.equal(input.language, language);
      assert.equal(input.instructions, "custom instructions");
      return language === "ar" ? [" افتح الدفتر "] : [" Open notebook "];
    }, "custom instructions");
    const result = await suggest("my new idea", language);
    assert.equal(result[0].decision, "pending");
    assert.ok(result[0].id);
    assert.equal(result[0].title, language === "ar" ? "افتح الدفتر" : "Open notebook");
  }
});
test("AI failure and invalid outputs propagate, never invent successful suggestions", async () => {
  await assert.rejects(createPlannerSuggester(async () => { throw new Error("offline"); })("idea", "ar"), /offline/);
  for (const invalid of [[], [""], ["a".repeat(241)], Array(7).fill("task"), [12]]) {
    await assert.rejects(createPlannerSuggester(async () => invalid as string[])("idea", "en"));
  }
});
