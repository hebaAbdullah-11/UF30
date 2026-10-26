import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { authUsersTable, db, plannerIdeasTable, plannerTasksTable, pool } from "@workspace/db";
import { createPlannerRouter } from "../routes/planner";
import { setSessionCookie } from "../lib/session";
import { createPlannerSuggester } from "./planner-suggestions.ts";
import type { PlannerTask, PlannerIdea, PlannerSnapshot } from "@workspace/api-zod";

// Run explicitly against development only. Accounts are synthetic local rows, not Supabase identities.
test("planner persistence, consent, concurrency, AI failure and account isolation", async t => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const ids = [randomUUID(), randomUUID()];
  const app = express();
  app.use(express.json());
  let offline = false;
  app.use("/api", createPlannerRouter(createPlannerSuggester(async ({ language }) => {
    if (offline) throw new Error("provider unavailable");
    return language === "ar" ? ["افتح الدفتر", "اكتب سطرًا", "راجع السطر"] : ["Open notebook", "Write a line", "Review the line"];
  })));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}/api/planner`;
  const cookies = ids.map(id => {
    let cookie = "";
    setSessionCookie({ headers: {}, secure: false } as Request, {
      cookie(name: string, value: string) { cookie = `${name}=${value}`; },
    } as unknown as Response, id);
    return cookie;
  });
  const day = "2026-10-26";
  async function api<T = PlannerSnapshot>(path: string, body?: unknown, account = 0, expected = 200): Promise<T> {
    const response = await fetch(`${origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: cookies[account], "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `Unexpected response for ${path}`);
    return response.json() as Promise<T>;
  }
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // Only delete rows belonging to these two IDs created by this test.
    await db.delete(plannerTasksTable).where(inArray(plannerTasksTable.userId, ids));
    await db.delete(plannerIdeasTable).where(inArray(plannerIdeasTable.userId, ids));
    await db.delete(authUsersTable).where(inArray(authUsersTable.id, ids));
    await pool.end();
  });
  await db.insert(authUsersTable).values(ids.map(id => ({
    id, name: "Planner integration fixture", email: `planner-${id}@example.invalid`, passwordHash: "not-a-login-password",
  })));
  const anonymous = await fetch(`${origin}?day=${day}`);
  assert.equal(anonymous.status, 401);
  await api("?day=2026-02-30", undefined, 0, 400);
  const task = await api<PlannerTask>("/tasks", { title: "Original task", kind: "task", scheduledDay: day, userId: ids[1] }, 0, 201);
  const reminder = await api<PlannerTask>("/tasks", { title: "Reminder", kind: "reminder", scheduledDay: day, reminderTime: "15:30" }, 0, 201);
  await api("/tasks", { title: "Invalid reminder", kind: "reminder", scheduledDay: day }, 0, 400);
  await api(`/tasks/${task.id}/action`, { action: "done", day }, 1, 404);
  assert.equal((await api(`?day=${day}`, undefined, 1)).tasks.length, 0);
  assert.equal((await api(`?day=${day}`)).tasks.length, 2);
  const started = await api<PlannerTask>(`/tasks/${task.id}/action`, { action: "start", day });
  assert.equal(started.status, "active");
  const idea = await api<PlannerIdea>("/ideas", { text: "أريد ترتيب أوراقي" }, 0, 201);
  assert.equal((await api(`?day=${day}`)).remaining, 2, "capture cannot create tasks");
  await api(`/ideas/${idea.id}/suggest`, { language: "ar" }, 1, 404);
  await api(`/ideas/${idea.id}/decide`, { day, approvedIds: [], rejectedIds: [] }, 1, 404);
  const suggested = await api<PlannerIdea>(`/ideas/${idea.id}/suggest`, { language: "ar" });
  assert.equal(suggested.suggestions[0].title, "افتح الدفتر");
  assert.equal((await api(`?day=${day}`)).remaining, 2, "suggestions cannot create tasks");
  const [one, two, three] = suggested.suggestions;
  await api(`/ideas/${idea.id}/decide`, { day, approvedIds: ["foreign-id"], rejectedIds: [] }, 0, 400);
  const rejected = await api<PlannerIdea>(`/ideas/${idea.id}/decide`, { day, approvedIds: [], rejectedIds: [two.id] });
  assert.equal(rejected.suggestions[1].decision, "rejected");
  assert.equal((await api(`?day=${day}`)).remaining, 2);
  await Promise.all(Array.from({ length: 3 }, () => api(`/ideas/${idea.id}/decide`, {
    day, approvedIds: [one.id], rejectedIds: [],
  })));
  const snapshot = await api(`?day=${day}`);
  assert.equal(snapshot.remaining, 3, "concurrent approval creates exactly one task");
  assert.equal(snapshot.ideas[0].suggestions.find(s => s.id === three.id)?.decision, "pending");
  assert.equal(snapshot.ideas[0].suggestions.find(s => s.id === two.id)?.decision, "rejected");
  await api(`/tasks/${task.id}/action`, { action: "done", day });
  await api(`/tasks/${reminder.id}/action`, { action: "defer", day, deferUntil: day }, 0, 400);
  await api(`/tasks/${reminder.id}/action`, { action: "defer", day });
  const after = await api(`?day=${day}`);
  assert.equal(after.completed, 1);
  assert.equal(after.deferred, 1);
  assert.equal(after.upcoming[0].reminderTime, "15:30");
  assert.equal(after.upcoming[0].scheduledDay, "2026-10-27");
  const rows = await db.select().from(plannerTasksTable).where(eq(plannerTasksTable.userId, ids[0]));
  assert.equal(rows.length, 3, "data persisted independently of client or session reloads");
  assert.equal((await api(`?day=${day}`, undefined, 1)).ideas.length, 0);
  const englishIdea = await api<PlannerIdea>("/ideas", { text: "Plan tomorrow" }, 1, 201);
  const english = await api<PlannerIdea>(`/ideas/${englishIdea.id}/suggest`, { language: "en" }, 1);
  assert.equal(english.suggestions[0].title, "Open notebook");
  const failedIdea = await api<PlannerIdea>("/ideas", { text: "Keep this idea on failure" }, 0, 201);
  offline = true;
  await api(`/ideas/${failedIdea.id}/suggest`, { language: "en" }, 0, 503);
  const persisted = (await api(`?day=${day}`)).ideas.find(i => i.id === failedIdea.id);
  assert.equal(persisted?.text, "Keep this idea on failure");
  assert.deepEqual(persisted?.suggestions, []);
});
