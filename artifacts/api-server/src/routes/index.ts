import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userProfilesRouter from "./user-profiles";
import userOnboardingRouter from "./user-onboarding";
import internalChatRouter from "./internal-chat";
import dailyQuestionsRouter from "./daily-questions";
import chatMediaRouter from "./chat-media";
import plannerRouter from "./planner";
import { createUf30InstitutionRouter } from "./uf30-institutions";
import { uf30InstitutionRepository } from "../services/uf30-institution-repository";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userProfilesRouter);
router.use(userOnboardingRouter);
router.use(internalChatRouter);
router.use(chatMediaRouter);
router.use(dailyQuestionsRouter);
router.use(plannerRouter);
router.use(createUf30InstitutionRouter(uf30InstitutionRepository));

export default router;
