import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export const authUsersTable = pgTable(
  "auth_users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    supabaseUserId: text("supabase_user_id"),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("auth_users_supabase_user_id_idx").on(table.supabaseUserId),
  ],
);

export const insertAuthUserSchema = createInsertSchema(authUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
export type AuthUser = typeof authUsersTable.$inferSelect;