import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { dailyQuestionAnswersTable, db } from "@workspace/db";
import {
  GetDailyQuestionAnswersParams,
  GetDailyQuestionAnswersResponse,
  SaveDailyQuestionAnswersBody,
  SaveDailyQuestionAnswersParams,
  SaveDailyQuestionAnswersResponse,
  ReflectOnDailyAnswersBody,
  ReflectOnDailyAnswersResponse,
} from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
import { getAgentResponse } from "../services/ai/agent-client";
import { reflectionRequest } from "../services/ai/reflection-request";
import { getSupabaseRequestAuth } from "../lib/supabase";

const router: IRouter = Router();
const pendingReflections = new Set<string>();

// Explicitly requested, read-only feedback; never rewrite or implicitly save daily answers.
router.post("/daily-reflection", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }
  const body = ReflectOnDailyAnswersBody.safeParse(req.body);
  if (!body.success || ![body.data.q1, body.data.q2, body.data.q3].every((answer) => answer.trim())) {
    res.status(400).json({ error: "Answer all three questions before requesting reflection." });
    return;
  }
  if (pendingReflections.has(userId)) {
    res.status(429).json({ error: "A reflection request is already running." });
    return;
  }
  pendingReflections.add(userId);
  try {
    const supabaseAuth = await getSupabaseRequestAuth(req, res).catch(() => null);
    const reply = await getAgentResponse("reflection", reflectionRequest(body.data, body.data.language), [], {
      language: body.data.language,
      dailyReflection: true,
      referenceAccessToken: supabaseAuth?.accessToken,
      onReferencesUnavailable: () => req.log.warn({ event: "reference_source_unavailable" }, "Supplemental reflection source unavailable"),
      onReferencesRetrieved: (agent, count) => req.log.info({ event: "references_retrieved", agent, count }, "Supplemental reflection references retrieved"),
      onAgentRouted: (agent) => req.log.info({ event: "agent_routed", agent }, "Daily reflection routing selected"),
    });
    if (reply.type !== "text") throw new Error("Unexpected reflection response.");
    res.json(ReflectOnDailyAnswersResponse.parse({ message: reply.message }));
  } catch {
    req.log.warn({ event: "reflection_unavailable" }, "Daily reflection agent unavailable");
    res.status(503).json({ error: "Reflection is temporarily unavailable. Your saved answers are unchanged." });
  } finally {
    pendingReflections.delete(userId);
  }
});

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function publicAnswers(row: typeof dailyQuestionAnswersTable.$inferSelect) {
  return {
    date: row.answerDate,
    q1: row.q1,
    q2: row.q2,
    q3: row.q3,
    updatedAt: row.updatedAt,
  };
}

router.get("/daily-questions/:date", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const params = GetDailyQuestionAnswersParams.safeParse(req.params);
  if (!params.success || !isCalendarDate(params.data.date)) {
    res.status(400).json({ error: "Use a valid calendar date." });
    return;
  }

  const [answers] = await db
    .select()
    .from(dailyQuestionAnswersTable)
    .where(
      and(
        eq(dailyQuestionAnswersTable.userId, userId),
        eq(dailyQuestionAnswersTable.answerDate, params.data.date),
      ),
    )
    .limit(1);

  res.json(
    GetDailyQuestionAnswersResponse.parse({
      date: params.data.date,
      answers: answers ? publicAnswers(answers) : null,
    }),
  );
});

router.put("/daily-questions/:date", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const params = SaveDailyQuestionAnswersParams.safeParse(req.params);
  const body = SaveDailyQuestionAnswersBody.safeParse(req.body);
  if (
    !params.success ||
    !isCalendarDate(params.data.date) ||
    !body.success ||
    Object.values(body.data).some((answer) => !answer.trim())
  ) {
    res.status(400).json({ error: "Answer all three questions before saving." });
    return;
  }

  const now = new Date();
  const [saved] = await db
    .insert(dailyQuestionAnswersTable)
    .values({
      userId,
      answerDate: params.data.date,
      q1: body.data.q1.trim(),
      q2: body.data.q2.trim(),
      q3: body.data.q3.trim(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        dailyQuestionAnswersTable.userId,
        dailyQuestionAnswersTable.answerDate,
      ],
      set: {
        q1: body.data.q1.trim(),
        q2: body.data.q2.trim(),
        q3: body.data.q3.trim(),
        updatedAt: now,
      },
    })
    .returning();

  if (!saved) {
    res.status(400).json({ error: "We could not save today's answers." });
    return;
  }
  res.json(SaveDailyQuestionAnswersResponse.parse(publicAnswers(saved)));
});

export default router;