/** Development-only browser fixtures. Never creates remote auth identities or touches existing users. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inArray } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, pool, authUsersTable, plannerTasksTable, plannerIdeasTable } from "@workspace/db";
import { setSessionCookie } from "../lib/session";

const fixturePath = resolve(import.meta.dirname, "../../../../generated-artifacts/planner-browser-fixture.json");
if (process.env.NODE_ENV === "production") throw new Error("Development fixtures only");
try {
  if (process.argv.includes("--cleanup")) {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as { users: { id: string }[] };
    const ids = fixture.users.map(u => u.id);
    await db.transaction(async tx => {
      await tx.delete(plannerTasksTable).where(inArray(plannerTasksTable.userId, ids));
      await tx.delete(plannerIdeasTable).where(inArray(plannerIdeasTable.userId, ids));
      await tx.delete(authUsersTable).where(inArray(authUsersTable.id, ids));
    });
    await rm(fixturePath);
    console.log("Removed only planner browser fixture accounts and their planner rows.");
  } else {
    const users = [0, 1].map(i => {
      const id = randomUUID();
      let cookie = "";
      setSessionCookie({ headers: {}, secure: false } as Request, {
        cookie(name: string, value: string) { cookie = `${name}=${value}`; },
      } as unknown as Response, id);
      return { id, name: `Planner Fixture ${i + 1}`, email: `planner-${id}@example.invalid`, cookie };
    });
    const ideaId = randomUUID();
    await db.transaction(async tx => {
      await tx.insert(authUsersTable).values(users.map(({ cookie: _, ...user }) => ({ ...user, passwordHash: "fixture-no-login" })));
      await tx.insert(plannerIdeasTable).values({
        id: ideaId, userId: users[0].id, text: "Fixture: arrange my desk",
        suggestions: [
          { id: randomUUID(), title: "Fixture: clear one corner", decision: "pending" },
          { id: randomUUID(), title: "Fixture: collect loose papers", decision: "pending" },
          { id: randomUUID(), title: "Fixture: put pens in a cup", decision: "pending" },
        ],
      });
    });
    await mkdir(resolve(fixturePath, ".."), { recursive: true });
    await writeFile(fixturePath, JSON.stringify({ users, ideaId }), { mode: 0o600 });
    console.log("Created isolated planner browser fixtures in the ignored generated-artifacts directory.");
  }
} finally { await pool.end(); }
