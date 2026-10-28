import { and, eq, isNull, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authUsersTable, db, userProfilesTable } from "@workspace/db";
import { SignInBody, SignUpBody } from "@workspace/api-zod";
import {
  assertSessionConfigured,
  clearSessionCookie,
  getSessionUserId,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "../lib/session";
import {
  clearSupabaseSessionCookies,
  getSupabaseRequestAuth,
  setSupabaseSessionCookies,
  signInWithSupabase,
  signOutFromSupabase,
  signUpWithSupabase,
} from "../lib/supabase";

const router: IRouter = Router();

class EmailInUseError extends Error {}
class ConfirmationRequiredError extends Error {}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function publicUser(user: typeof authUsersTable.$inferSelect) {
  return { id: user.id, name: user.name, email: user.email };
}

function isSupabaseSession(
  value: Awaited<ReturnType<typeof signUpWithSupabase>>,
): value is Awaited<ReturnType<typeof signInWithSupabase>> {
  return (
    "access_token" in value &&
    typeof value.access_token === "string" &&
    "refresh_token" in value &&
    typeof value.refresh_token === "string"
  );
}

async function linkSupabaseIdentity(input: {
  supabaseUserId: string;
  email: string;
  name: string;
  password: string;
  allowExistingPasswordMigration: boolean;
}) {
  return db.transaction(async (transaction) => {
    const [byIdentity] = await transaction
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.supabaseUserId, input.supabaseUserId))
      .limit(1);
    if (byIdentity) return byIdentity;

    const [byEmail] = await transaction
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.email, input.email))
      .limit(1);
    if (byEmail) {
      if (
        byEmail.supabaseUserId &&
        byEmail.supabaseUserId !== input.supabaseUserId
      ) {
        throw new EmailInUseError();
      }
      if (
        input.allowExistingPasswordMigration &&
        !(await verifyPassword(input.password, byEmail.passwordHash))
      ) {
        throw new EmailInUseError();
      }
      const [linked] = await transaction
        .update(authUsersTable)
        .set({ supabaseUserId: input.supabaseUserId })
        .where(
          and(
            eq(authUsersTable.id, byEmail.id),
            or(
              isNull(authUsersTable.supabaseUserId),
              eq(authUsersTable.supabaseUserId, input.supabaseUserId),
            ),
          ),
        )
        .returning();
      if (!linked) throw new Error("Unable to link the Supabase identity.");
      return linked;
    }

    const [legacyProfile] = await transaction
      .select({ userId: userProfilesTable.clerkUserId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.email, input.email))
      .limit(1);
    const passwordHash = await hashPassword(input.password);
    const [created] = await transaction
      .insert(authUsersTable)
      .values({
        id: legacyProfile?.userId,
        supabaseUserId: input.supabaseUserId,
        name: input.name,
        email: input.email,
        passwordHash,
      })
      .returning();
    if (!created) throw new Error("User insert returned no record.");
    if (!legacyProfile) {
      await transaction
        .insert(userProfilesTable)
        .values({ clerkUserId: created.id, name: input.name, email: input.email });
    }
    return created;
  });
}

function confirmationRequired(res: Parameters<Parameters<IRouter["post"]>[1]>[1]) {
  res.status(403).json({
    code: "EMAIL_CONFIRMATION_REQUIRED",
    error: "Confirm your email, then sign in to continue.",
  });
}

router.post("/auth/sign-up", async (req, res): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") {
      res.status(400).json({ code: "NAME_REQUIRED", error: "Name is required." });
    } else if (field === "email") {
      res.status(400).json({ code: "EMAIL_INVALID", error: "Email is invalid." });
    } else if (field === "password") {
      res.status(400).json({
        code: "PASSWORD_TOO_SHORT",
        error: "Password must be at least 8 characters.",
      });
    } else {
      res.status(400).json({ code: "INVALID_REQUEST", error: "Invalid request." });
    }
    return;
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  try {
    assertSessionConfigured();
    const supabase = await signUpWithSupabase(email, parsed.data.password, name);
    const supabaseUser = supabase.user;
    const user = await linkSupabaseIdentity({
      supabaseUserId: supabaseUser.id,
      email,
      name,
      password: parsed.data.password,
      allowExistingPasswordMigration: true,
    });
    if (!isSupabaseSession(supabase)) {
      confirmationRequired(res);
      return;
    }
    setSupabaseSessionCookies(req, res, supabase);
    setSessionCookie(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof EmailInUseError || isUniqueViolation(error)) {
      res.status(409).json({
        code: "EMAIL_IN_USE",
        error: "An account with this email already exists.",
      });
      return;
    }
    req.log.error({ err: error }, "Unable to create Supabase user");
    res.status(500).json({
      code: "SIGN_UP_FAILED",
      error: "We couldn't create your account just now.",
    });
  }
});

router.post("/auth/sign-in", async (req, res): Promise<void> => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    res.status(400).json({
      code: field === "email" ? "EMAIL_INVALID" : "PASSWORD_TOO_SHORT",
      error: field === "email" ? "Email is invalid." : "Password must be at least 8 characters.",
    });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    let supabase;
    try {
      supabase = await signInWithSupabase(email, parsed.data.password);
    } catch (signInError) {
      const [legacy] = await db
        .select()
        .from(authUsersTable)
        .where(eq(authUsersTable.email, email))
        .limit(1);
      if (
        !legacy ||
        legacy.supabaseUserId ||
        !(await verifyPassword(parsed.data.password, legacy.passwordHash))
      ) {
        throw signInError;
      }
      const migrated = await signUpWithSupabase(email, parsed.data.password, legacy.name);
      if (!isSupabaseSession(migrated)) throw new ConfirmationRequiredError();
      supabase = migrated;
    }

    const metadataName = supabase.user.user_metadata?.name;
    const user = await linkSupabaseIdentity({
      supabaseUserId: supabase.user.id,
      email,
      name: typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : email.split("@")[0]!,
      password: parsed.data.password,
      allowExistingPasswordMigration: false,
    });
    setSupabaseSessionCookies(req, res, supabase);
    setSessionCookie(req, res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof ConfirmationRequiredError) {
      confirmationRequired(res);
      return;
    }
    req.log.warn({ error }, "Supabase sign-in rejected");
    res.status(401).json({
      code: "INVALID_CREDENTIALS",
      error: "The email or password is not correct.",
    });
  }
});

router.post("/auth/sign-out", async (req, res): Promise<void> => {
  const auth = await getSupabaseRequestAuth(req, res).catch(() => null);
  if (auth) await signOutFromSupabase(auth.accessToken).catch(() => undefined);
  clearSupabaseSessionCookies(req, res);
  clearSessionCookie(req, res);
  res.status(204).end();
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  const auth = await getSupabaseRequestAuth(req, res).catch(() => null);
  if (!userId || !auth) {
    clearSupabaseSessionCookies(req, res);
    clearSessionCookie(req, res);
    res.json({ user: null });
    return;
  }

  const [user] = await db
    .select()
    .from(authUsersTable)
    .where(
      and(
        eq(authUsersTable.id, userId),
        eq(authUsersTable.supabaseUserId, auth.user.id),
      ),
    )
    .limit(1);
  if (!user) {
    clearSupabaseSessionCookies(req, res);
    clearSessionCookie(req, res);
    res.json({ user: null });
    return;
  }

  res.json({ user: publicUser(user) });
});

export default router;
