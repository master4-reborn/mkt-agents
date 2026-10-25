import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

// One brand = one office session (same team, its own workspace, conversation and budget).
export const brands = pgTable("brands", {
  id: text("id").primaryKey(), // Managed Agents session id
  sentence: text("sentence").notNull(), // what the boss said the brand is, shown until BRAND.md names it
  memoryStoreId: text("memory_store_id"), // the brand's memory store; null for an office opened before memory existed
  slug: text("slug"), // the store's name is brand-<slug>, mounted at /mnt/memory/brand-<slug>/
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The current content of every memory file the team can read: the boss's shared store and each brand's own.
// Mirrored from the API by the poll so pages render from the database; edits write through to the API.
export const memories = pgTable("memories", {
  id: text("id").primaryKey(), // Anthropic memory id
  store: text("store").notNull(), // memory store id
  path: text("path").notNull(), // /bai-hoc.md, /quyet-dinh.md, ...
  content: text("content").notNull(),
  sha256: text("sha256").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// One row per file version the office wrote to /mnt/session/outputs/.
// `name` is the basename; the newest row per name and brand is the current version.
export const files = pgTable("files", {
  id: text("id").primaryKey(), // Anthropic file id
  brand: text("brand").notNull(), // session id
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
  brand: text("brand").notNull(),
  fileName: text("file_name").notNull(),
  decision: text("decision").notNull(), // approved | rejected
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // session event id
  brand: text("brand").notNull(),
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
  brand: text("brand").notNull(),
  agent: text("agent").notNull(), // lead | research | writer | qa | metrics
  kind: text("kind").notNull(), // task | report | running | idle
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
