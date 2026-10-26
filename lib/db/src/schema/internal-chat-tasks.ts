import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export const internalChatTasksTable = pgTable(
  "internal_chat_tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    task: text("task").notNull(),
    deadline: integer("deadline"),
    importance: integer("importance"),
    impact: integer("impact"),
    priorityScore: integer("priority_score"),
    priority: integer("priority"),
    reason: text("reason"),
    nextStep: text("next_step"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("internal_chat_tasks_conversation_idx").on(table.conversationId),
    index("internal_chat_tasks_user_idx").on(table.userId),
  ],
);

export const insertInternalChatTaskSchema = createInsertSchema(internalChatTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInternalChatTask = z.infer<typeof insertInternalChatTaskSchema>;
export type InternalChatTask = typeof internalChatTasksTable.$inferSelect;