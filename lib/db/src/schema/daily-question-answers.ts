import { createInsertSchema } from "drizzle-zod";
import {
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export const dailyQuestionAnswersTable = pgTable(
  "daily_question_answers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull(),
    answerDate: date("answer_date", { mode: "string" }).notNull(),
    q1: text("q1").notNull(),
    q2: text("q2").notNull(),
    q3: text("q3").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("daily_question_answers_user_date_unique").on(
      table.userId,
      table.answerDate,
    ),
  ],
);

export const insertDailyQuestionAnswersSchema = createInsertSchema(
  dailyQuestionAnswersTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDailyQuestionAnswers = z.infer<
  typeof insertDailyQuestionAnswersSchema
>;
export type DailyQuestionAnswers =
  typeof dailyQuestionAnswersTable.$inferSelect;