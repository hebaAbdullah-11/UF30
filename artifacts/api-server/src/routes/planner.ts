import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, plannerIdeasTable as ideas, plannerTasksTable as tasks } from "@workspace/db";
import {
  GetPlannerQueryParams, GetPlannerResponse, CreatePlannerTaskBody, CreatePlannerTaskResponse,
  ActOnPlannerTaskParams, ActOnPlannerTaskBody, ActOnPlannerTaskResponse,
  CapturePlannerIdeaBody, CapturePlannerIdeaResponse, SuggestPlannerTasksParams,
  SuggestPlannerTasksBody, SuggestPlannerTasksResponse, DecidePlannerSuggestionsParams,
  DecidePlannerSuggestionsBody, DecidePlannerSuggestionsResponse,
} from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
import { decideProposals, isCalendarDay, projectDay, taskAction } from "../services/planner-policy.ts";
import { suggestPlannerIdeas } from "../services/planner-ai.ts";

export function createPlannerRouter(suggest = suggestPlannerIdeas): IRouter {
const router: IRouter = Router();
// Identity comes exclusively from the existing AFTA session, never request body/query.
router.use("/planner", (req, res, next) => {
  if (!getSessionUserId(req)) { res.status(401).json({ error: "Authentication required" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

router.get("/planner", async (req, res): Promise<void> => {
  const parsed = GetPlannerQueryParams.safeParse(req.query);
  if (!parsed.success || !isCalendarDay(parsed.data.day)) { res.status(400).json({ error: "Invalid day" }); return; }
  const userId = getSessionUserId(req)!;
  const [allTasks, allIdeas] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.scheduledDay), asc(tasks.createdAt), asc(tasks.id)),
    db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.createdAt)),
  ]);
  res.json(GetPlannerResponse.parse({ ...projectDay(allTasks, parsed.data.day), ideas: allIdeas }));
});

router.post("/planner/tasks", async (req, res): Promise<void> => {
  const parsed = CreatePlannerTaskBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim() || !isCalendarDay(parsed.data.scheduledDay) ||
    (parsed.data.kind === "reminder" && !parsed.data.reminderTime)) {
    res.status(400).json({ error: "Invalid task or reminder" }); return;
  }
  const [task] = await db.insert(tasks).values({
    ...parsed.data, title: parsed.data.title.trim(), userId: getSessionUserId(req)!,
  }).returning();
  res.status(201).json(CreatePlannerTaskResponse.parse(task));
});

router.post("/planner/tasks/:id/action", async (req, res): Promise<void> => {
  const params = ActOnPlannerTaskParams.safeParse(req.params);
  const body = ActOnPlannerTaskBody.safeParse(req.body);
  if (!params.success || !body.success || !isCalendarDay(body.data.day)) { res.status(400).json({ error: "Invalid action" }); return; }
  const owner = and(eq(tasks.userId, getSessionUserId(req)!), eq(tasks.id, params.data.id));
  const result = await db.transaction(async tx => {
    const [current] = await tx.select().from(tasks).where(owner).for("update");
    if (!current) return null;
    const patch = taskAction(current, body.data.action, body.data.day, body.data.deferUntil);
    if (!Object.keys(patch).length) return current;
    const [updated] = await tx.update(tasks).set(patch).where(owner).returning();
    return updated;
  }).catch(error => {
    if (error instanceof Error && error.message === "Choose a future day") return "invalid" as const;
    throw error;
  });
  if (result === "invalid") { res.status(400).json({ error: "Choose a future day" }); return; }
  if (!result) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(ActOnPlannerTaskResponse.parse(result));
});

router.post("/planner/ideas", async (req, res): Promise<void> => {
  const parsed = CapturePlannerIdeaBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.text.trim()) { res.status(400).json({ error: "Invalid idea" }); return; }
  const [idea] = await db.insert(ideas).values({ text: parsed.data.text.trim(), userId: getSessionUserId(req)! }).returning();
  res.status(201).json(CapturePlannerIdeaResponse.parse(idea));
});

router.post("/planner/ideas/:id/suggest", async (req, res): Promise<void> => {
  const params = SuggestPlannerTasksParams.safeParse(req.params);
  const body = SuggestPlannerTasksBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const owner = and(eq(ideas.userId, getSessionUserId(req)!), eq(ideas.id, params.data.id));
  const [idea] = await db.select().from(ideas).where(owner);
  if (!idea) { res.status(404).json({ error: "Idea not found" }); return; }
  if (idea.suggestions.length) { res.json(SuggestPlannerTasksResponse.parse(idea)); return; }
  let suggestions;
  try { suggestions = await suggest(idea.text, body.data.language); }
  catch {
    // No fabricated fallback, and the captured idea is already durable.
    res.status(503).json({ error: "AI_UNAVAILABLE" }); return;
  }
  const result = await db.transaction(async tx => {
    const [current] = await tx.select().from(ideas).where(owner).for("update");
    if (current.suggestions.length) return current;
    const [updated] = await tx.update(ideas).set({ suggestions }).where(owner).returning();
    return updated;
  });
  res.json(SuggestPlannerTasksResponse.parse(result));
});

router.post("/planner/ideas/:id/decide", async (req, res): Promise<void> => {
  const params = DecidePlannerSuggestionsParams.safeParse(req.params);
  const body = DecidePlannerSuggestionsBody.safeParse(req.body);
  if (!params.success || !body.success || !isCalendarDay(body.data.day)) { res.status(400).json({ error: "Invalid selection" }); return; }
  const userId = getSessionUserId(req)!;
  const owner = and(eq(ideas.userId, userId), eq(ideas.id, params.data.id));
  const result = await db.transaction(async tx => {
    const [idea] = await tx.select().from(ideas).where(owner).for("update");
    if (!idea) return null;
    const decision = decideProposals(idea.suggestions, body.data.approvedIds, body.data.rejectedIds);
    if (decision.newlyApproved.length) await tx.insert(tasks).values(decision.newlyApproved.map(proposal => ({
      userId, title: proposal.title, scheduledDay: body.data.day,
    })));
    const [updated] = await tx.update(ideas).set({ suggestions: decision.suggestions }).where(owner).returning();
    return updated;
  }).catch(error => {
    if (error instanceof Error && error.message === "Invalid selection") return "invalid" as const;
    throw error;
  });
  if (result === "invalid") { res.status(400).json({ error: "Invalid selection" }); return; }
  if (!result) { res.status(404).json({ error: "Idea not found" }); return; }
  res.json(DecidePlannerSuggestionsResponse.parse(result));
});

return router;
}

export default createPlannerRouter();
