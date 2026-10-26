import { randomUUID } from "node:crypto";
import { date, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { authUsersTable } from "./auth-users";

export type PlannerProposal = { id: string; title: string; decision: "pending" | "approved" | "rejected" };
export const plannerTasksTable = pgTable("planner_tasks", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: text("user_id").notNull().references(() => authUsersTable.id),
  title: text("title").notNull(),
  kind: text("kind").$type<"task" | "reminder" | "exercise">().notNull().default("task"),
  status: text("status").$type<"pending" | "active" | "done">().notNull().default("pending"),
  scheduledDay: date("scheduled_day", { mode: "string" }).notNull(),
  reminderTime: text("reminder_time"),
  completedDay: date("completed_day", { mode: "string" }),
  deferredOn: date("deferred_on", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("planner_tasks_owner_day_idx").on(table.userId, table.scheduledDay)]);

export const plannerIdeasTable = pgTable("planner_ideas", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: text("user_id").notNull().references(() => authUsersTable.id),
  text: text("text").notNull(),
  suggestions: jsonb("suggestions").$type<PlannerProposal[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("planner_ideas_owner_idx").on(table.userId)]);

export const insertPlannerTaskSchema = createInsertSchema(plannerTasksTable).omit({ id: true, createdAt: true });
export const insertPlannerIdeaSchema = createInsertSchema(plannerIdeasTable).omit({ id: true, createdAt: true });
export type PlannerTaskRow = typeof plannerTasksTable.$inferSelect;
export type PlannerIdeaRow = typeof plannerIdeasTable.$inferSelect;
