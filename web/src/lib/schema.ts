import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

// One row per file version the office wrote to /mnt/session/outputs/.
// `name` is the basename; the newest row per name is the current version.
export const files = pgTable("files", {
  id: text("id").primaryKey(), // Anthropic file id
  name: text("name").notNull(),
  kind: text("kind").notNull(), // brand | research | draft | report | other
  week: text("week"),
  status: text("status"),
  title: text("title"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  decision: text("decision").notNull(), // approved | rejected
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // session event id
  role: text("role").notNull(), // boss | lead
  text: text("text").notNull(),
  stopReason: text("stop_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// What each employee is doing: thread status changes and the messages between the lead and its team.
export const activity = pgTable("activity", {
  id: text("id").primaryKey(), // session event id
  agent: text("agent").notNull(), // lead | research | writer | qa | metrics
  kind: text("kind").notNull(), // task | report | running | idle
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
