import { sql } from "drizzle-orm";
import { db } from "./client";

export type UserTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `work` in a transaction as the restricted `app_user` role with
 * `app.user_id` set, so row-level-security policies limit every query to this
 * user's rows. All access to personal tables must go through this helper.
 * Both settings are transaction-local, which keeps them safe with the
 * Supabase transaction pooler.
 */
export function withUser<T>(userId: string, work: (tx: UserTx) => Promise<T>): Promise<T> {
  if (!userId) throw new Error("withUser requires a user id");
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return work(tx);
  });
}
