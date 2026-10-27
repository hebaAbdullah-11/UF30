import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export type OnboardingChatAnswers = {
  interests: string[];
  dailyNeeds: string[];
  supportPreference: string;
};

export const userOnboardingTable = pgTable("user_onboarding", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  stage: text("stage").notNull().default("intro"),
  introStep: integer("intro_step").notNull().default(0),
  chatAnswers: jsonb("chat_answers")
    .$type<OnboardingChatAnswers>()
    .notNull()
    .default({
      interests: [],
      dailyNeeds: [],
      supportPreference: "",
    }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserOnboardingSchema = createInsertSchema(
  userOnboardingTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserOnboarding = z.infer<
  typeof insertUserOnboardingSchema
>;
export type UserOnboarding = typeof userOnboardingTable.$inferSelect;