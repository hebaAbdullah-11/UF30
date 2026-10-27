import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  userOnboardingTable,
  type OnboardingChatAnswers,
} from "@workspace/db";
import {
  GetUserOnboardingResponse,
  UpdateUserOnboardingBody,
  UpdateUserOnboardingResponse,
} from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";

const router: IRouter = Router();
const stageOrder = ["intro", "chat", "complete"] as const;

function hasCompleteChat(answers: OnboardingChatAnswers) {
  return (
    answers.interests.length > 0 &&
    answers.dailyNeeds.length > 0 &&
    (answers.supportPreference === "supportGentle" ||
      answers.supportPreference === "supportStructured")
  );
}

async function getOrCreateOnboarding(clerkUserId: string) {
  const [existing] = await db
    .select()
    .from(userOnboardingTable)
    .where(eq(userOnboardingTable.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userOnboardingTable)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: userOnboardingTable.clerkUserId })
    .returning();

  if (created) return created;

  const [concurrent] = await db
    .select()
    .from(userOnboardingTable)
    .where(eq(userOnboardingTable.clerkUserId, clerkUserId))
    .limit(1);

  if (!concurrent) {
    throw new Error("Unable to initialize onboarding");
  }

  return concurrent;
}

router.get("/users/onboarding", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const onboarding = await getOrCreateOnboarding(userId);
  res.json(GetUserOnboardingResponse.parse(onboarding));
});

router.put("/users/onboarding", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const parsed = UpdateUserOnboardingBody.safeParse(req.body);

  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid onboarding update",
    );
    res.status(400).json({ error: "Please check your answers and try again." });
    return;
  }

  const data = parsed.data;
  const current = await getOrCreateOnboarding(userId);
  const nextStage = data.stage ?? current.stage;
  const currentStageIndex = stageOrder.indexOf(
    current.stage as (typeof stageOrder)[number],
  );
  const nextStageIndex = stageOrder.indexOf(
    nextStage as (typeof stageOrder)[number],
  );
  const introStep = data.introStep ?? current.introStep;
  const chatAnswers = data.chatAnswers ?? current.chatAnswers;

  if (
    currentStageIndex < 0 ||
    nextStageIndex < currentStageIndex ||
    nextStageIndex > currentStageIndex + 1
  ) {
    res.status(400).json({ error: "That onboarding step is not available yet." });
    return;
  }

  if (nextStageIndex >= 1 && introStep !== 3) {
    res.status(400).json({ error: "Please finish the introduction first." });
    return;
  }

  if (nextStage === "complete" && !hasCompleteChat(chatAnswers)) {
    res.status(400).json({ error: "Please complete the introductory chat." });
    return;
  }

  const completedAt =
    nextStage === "complete"
      ? current.completedAt ?? new Date()
      : current.completedAt;

  const [onboarding] = await db
    .update(userOnboardingTable)
    .set({
      stage: nextStage,
      introStep,
      chatAnswers,
      completedAt,
      updatedAt: new Date(),
    })
    .where(eq(userOnboardingTable.clerkUserId, userId))
    .returning();

  if (!onboarding) {
    res.status(400).json({ error: "We couldn't save your progress just yet." });
    return;
  }

  res.json(UpdateUserOnboardingResponse.parse(onboarding));
});

export default router;