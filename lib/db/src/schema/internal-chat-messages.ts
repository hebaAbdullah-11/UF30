import { createInsertSchema } from "drizzle-zod";
import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export type AgentTextResponse = {
  type: "text";
  message: string;
  image?: { objectPath: string; contentType: string };
};

export type AgentTaskSequenceResponse = {
  type: "task_sequence";
  message: string;
  steps: Array<{ order: number; title: string; done: boolean }>;
};

export type AgentThoughtClustersResponse = {
  type: "thought_clusters";
  message: string;
  clusters: Array<{ label: string; items: string[] }>;
};

export type InteractiveOption = {
  id: string;
  label: string;
  value: string;
};

export type AgentInteractiveResponse = {
  type: "interactive";
  message: string;
  options: InteractiveOption[];
  allowFreeText: boolean;
  nextAction: "ask" | "prioritize" | "start_task" | "summarize";
};

export type AgentPriorityItem = {
  priority: number;
  task: string;
  reason: string;
  nextStep: string;
  priorityScore?: number;
};

export type AgentPriorityResponse = {
  type: "priority_list";
  message: string;
  items: AgentPriorityItem[];
  options: InteractiveOption[];
  nextAction: "start_task" | "summarize";
};

export type AgentFlowchartResponse = {
  type: "flowchart";
  message: string;
  title: string;
  mermaid: string;
};

export type AgentResponse =
  | AgentTextResponse
  | AgentTaskSequenceResponse
  | AgentThoughtClustersResponse
  | AgentInteractiveResponse
  | AgentPriorityResponse
  | AgentFlowchartResponse;

export const internalChatMessagesTable = pgTable(
  "internal_chat_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sequence: serial("sequence").notNull(),
    userId: text("user_id").notNull(),
    section: text("section").notNull(),
    role: text("role").notNull(),
    response: jsonb("response").$type<AgentResponse>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("internal_chat_user_section_created_idx").on(
      table.userId,
      table.section,
      table.createdAt,
    ),
  ],
);

export const insertInternalChatMessageSchema = createInsertSchema(
  internalChatMessagesTable,
).omit({
  id: true,
  sequence: true,
  createdAt: true,
});

export type InsertInternalChatMessage = z.infer<
  typeof insertInternalChatMessageSchema
>;
export type InternalChatMessage =
  typeof internalChatMessagesTable.$inferSelect;