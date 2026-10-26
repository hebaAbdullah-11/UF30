import { randomUUID } from "node:crypto";
import { index, integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { authUsersTable } from "./auth-users";

export const uf30InstitutionsTable = pgTable("uf30_institutions", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  slug: text("slug").notNull().unique(),
  nameArabic: text("name_arabic").notNull(),
  nameEnglish: text("name_english").notNull(),
  invitationCodeHash: text("invitation_code_hash").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uf30InstitutionMembersTable = pgTable("uf30_institution_members", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  institutionId: text("institution_id").notNull().references(() => uf30InstitutionsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("uf30_institution_member_unique_idx").on(table.userId),
]);

export const uf30ParticipantsTable = pgTable("uf30_participants", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  institutionId: text("institution_id").notNull().references(() => uf30InstitutionsTable.id, { onDelete: "cascade" }),
  participantTokenHash: text("participant_token_hash").notNull().unique(),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("uf30_participant_institution_idx").on(table.institutionId)]);

export const uf30ImpactMeasurementsTable = pgTable("uf30_impact_measurements", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  participantId: text("participant_id").notNull().references(() => uf30ParticipantsTable.id, { onDelete: "cascade" }),
  phase: text("phase").$type<"baseline" | "after_session_four" | "after_two_months">().notNull(),
  onTimeCompletion: real("on_time_completion").notNull(),
  punctuality: real("punctuality").notNull(),
  managerRating: real("manager_rating").notNull(),
  participantSatisfaction: real("participant_satisfaction").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("uf30_impact_participant_phase_unique_idx").on(table.participantId, table.phase),
  index("uf30_impact_phase_idx").on(table.phase),
]);

export const insertUf30InstitutionSchema = createInsertSchema(uf30InstitutionsTable).omit({ id: true, createdAt: true });
export const insertUf30InstitutionMemberSchema = createInsertSchema(uf30InstitutionMembersTable).omit({ id: true, createdAt: true });
export const insertUf30ParticipantSchema = createInsertSchema(uf30ParticipantsTable).omit({ id: true, enrolledAt: true });
export const insertUf30ImpactMeasurementSchema = createInsertSchema(uf30ImpactMeasurementsTable).omit({ id: true, submittedAt: true });
export type Uf30Institution = z.infer<typeof insertUf30InstitutionSchema>;
export type Uf30InstitutionMember = z.infer<typeof insertUf30InstitutionMemberSchema>;
export type Uf30Participant = z.infer<typeof insertUf30ParticipantSchema>;
export type Uf30ImpactMeasurement = typeof uf30ImpactMeasurementsTable.$inferSelect;
