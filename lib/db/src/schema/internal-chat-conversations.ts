import { createInsertSchema } from "drizzle-zod";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export const internalChatConversationsTable = pgTable(
  "internal_chat_conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull(),
    section: text("section").notNull(),
    state: jsonb("state").$type<Record<string, unknown>>().notNull(),
    language: text("language").notNull().default("ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("internal_chat_conversation_user_section_idx").on(table.userId, table.section),
    index("internal_chat_conversation_user_idx").on(table.userId),
  ],
);

export const insertInternalChatConversationSchema = createInsertSchema(
  internalChatConversationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertInternalChatConversation = z.infer<typeof insertInternalChatConversationSchema>;
export type InternalChatConversation = typeof internalChatConversationsTable.$inferSelect;