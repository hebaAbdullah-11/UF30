import { Router, type IRouter } from "express";
import { db, userProfilesTable } from "@workspace/db";
import {
  SyncUserProfileBody,
  SyncUserProfileResponse,
} from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
const router: IRouter = Router();
router.post("/users/sync", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }
  const parsed = SyncUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid user profile");
    res
      .status(400)
      .json({ error: "Please check the profile details and try again." });
    return;
  }
  const [profile] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: userId,
      name: parsed.data.name,
      email: parsed.data.email,
    })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: {
        name: parsed.data.name,
        email: parsed.data.email,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!profile) {
    res.status(400).json({ error: "We couldn't save your details just yet." });
    return;
  }
  res.json(SyncUserProfileResponse.parse(profile));
});
export default router;
