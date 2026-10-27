// Mirrors lib/db/migrations/0002_my_day.sql (the SQL is the source of truth for
// constraints and RLS). Access these tables only through withUser().
import { randomUUID } from "node:crypto";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { ItemType, PrayerAdjustments, Recurrence, Timing } from "@workspace/day-core";
import { authUsersTable } from "./auth-users";

const userId = () => text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  timeZone: text("time_zone").notNull().default("Asia/Riyadh"),
  cityName: text("city_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  prayerMethod: text("prayer_method").$type<"umm_al_qura" | "mwl" | "egyptian" | "karachi" | "dubai">().notNull().default("umm_al_qura"),
  prayerAdjustments: jsonb("prayer_adjustments").$type<PrayerAdjustments>().notNull().default({}),
  countPrayers: boolean("count_prayers").notNull().default(true),
  dayStart: text("day_start").$type<"midnight" | "fajr">().notNull().default("midnight"),
  theme: text("theme").$type<"system" | "light" | "dark">().notNull().default("system"),
  fontScale: real("font_scale").notNull().default(1),
  beliefFrequency: text("belief_frequency").$type<"off" | "1h" | "2h">().notNull().default("off"),
  quietStart: text("quiet_start").notNull().default("22:00"),
  quietEnd: text("quiet_end").notNull().default("07:00"),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export const filesTable = pgTable("files", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: userId(),
  storageKey: text("storage_key").notNull().unique(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}).enableRLS();

export const itemsTable = pgTable("items", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: userId(),
  title: text("title").notNull(),
  type: text("type").$type<ItemType>().notNull().default("task"),
  timing: jsonb("timing").$type<Timing>().notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(25),
  recurrence: jsonb("recurrence").$type<Recurrence>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  source: text("source").$type<"user" | "program" | "ai" | "planner">().notNull().default("user"),
  attachmentFileId: text("attachment_file_id").references(() => filesTable.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}).enableRLS();

export const itemLogsTable = pgTable("item_logs", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: userId(),
  day: date("day", { mode: "string" }).notNull(),
  entryKey: text("entry_key").notNull(),
  status: text("status").$type<"pending" | "done" | "snoozed" | "skipped">().notNull(),
  snoozedUntil: integer("snoozed_until"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [unique().on(table.userId, table.day, table.entryKey)]).enableRLS();

export const daySummariesTable = pgTable("day_summaries", {
  userId: userId(),
  day: date("day", { mode: "string" }).notNull(),
  planned: integer("planned").notNull(),
  done: integer("done").notNull(),
  updatedAt: updatedAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.day] })]).enableRLS();

export const beliefsTable = pgTable("beliefs", {
  id: text("id").primaryKey().$defaultFn(randomUUID),
  userId: userId(),
  text: text("text").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}).enableRLS();

export type ItemRow = typeof itemsTable.$inferSelect;
export type UserSettingsRow = typeof userSettingsTable.$inferSelect;
export type BeliefRow = typeof beliefsTable.$inferSelect;
export type FileRow = typeof filesTable.$inferSelect;
