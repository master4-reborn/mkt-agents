import { pgTable, text, timestamp, serial, integer } from "drizzle-orm/pg-core";

// One brand = one office session (same team, its own workspace, conversation and budget).
export const brands = pgTable("brands", {
  id: text("id").primaryKey(), // Managed Agents session id
  sentence: text("sentence").notNull(), // what the boss said the brand is, shown until BRAND.md names it
  memoryStoreId: text("memory_store_id"), // the brand's memory store; null for an office opened before memory existed
  slug: text("slug"), // the store's name is brand-<slug>, mounted at /mnt/memory/brand-<slug>/
  schedule: text("schedule"), // "mon" = the cron sends "Chạy tuần mới" every Monday morning; null = the boss runs weeks by hand
  notionRead: text("notion_read"), // JSON: the Notion database the team reads for this brand, or null
  notionSave: text("notion_save"), // JSON: the Notion page the app saves this brand's copies under, or null
  gmailLabel: text("gmail_label"), // the Gmail label the team reads for this brand, or null
  gmailCopy: text("gmail_copy"), // "1" = the app mails a copy of each approved post to the boss's own address
  driveRead: text("drive_read"), // JSON: the Drive folder the team reads for this brand, or null
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

// A storage the boss connected (Notion, Gmail, Drive): one row per kind, the key sealed with CONNECT_KEY (lib/crypto.ts).
export const connections = pgTable("connections", {
  kind: text("kind").primaryKey(), // notion | gmail | drive
  secret: text("secret").notNull(), // sealed key, opened only on the server
  label: text("label").notNull(), // what the key unlocked, shown on the page: workspace name, address
  status: text("status").notNull(), // ok | error
  error: text("error"),
  meta: text("meta").notNull().default("{}"), // JSON: the Notion databases the app created, per save page
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
});

// One copy the app saved outside the office (a Notion row) per file version; an error row is retried by the next poll.
export const mirrors = pgTable("mirrors", {
  id: serial("id").primaryKey(),
  brand: text("brand").notNull(),
  fileId: text("file_id").notNull(),
  target: text("target").notNull(), // notion
  externalId: text("external_id"),
  url: text("url"),
  status: text("status").notNull(), // ok | error
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A skill the scout proposed: one row per skill and scope; its texts are numbered versions in skill_versions, and exactly
// one is current while the skill is active. Offices read only the current text, which the app writes into memory.
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  scope: text("scope").notNull(), // "shared" for every brand, or one brand's session id
  slug: text("slug").notNull(), // ASCII; the memory file is ky-nang/<slug>.md
  title: text("title").notNull(),
  receivers: text("receivers").notNull(), // comma-separated employees: writer,qa
  type: text("type"), // writing | quality | research | numbers | planning
  status: text("status").notNull(), // new (nothing approved yet) | active | retired
  current: integer("current"), // the current version number, null until one is approved
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skillVersions = pgTable("skill_versions", {
  id: serial("id").primaryKey(),
  skill: integer("skill").notNull(),
  version: integer("version"), // numbered on approval or restore; null while proposed and when rejected
  status: text("status").notNull(), // proposed | current | superseded | rejected
  content: text("content").notNull(), // the skill file the team reads
  review: text("review").notNull(), // the scout's review file (why now, changes, warnings); empty for a restore
  base: integer("base"), // the version the proposal started from
  run: text("run"), // the scout session that proposed it
  edited: text("edited"), // "1" when the boss edited the rules before approving
  reason: text("reason"), // the boss's reason to reject, or what a restore brought back
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One scout session per run, from the button or the schedule. The poll collects its two files when it stops.
export const scoutRuns = pgTable("scout_runs", {
  id: text("id").primaryKey(), // session id
  scope: text("scope").notNull(),
  focus: text("focus"),
  trigger: text("trigger").notNull(), // button | schedule
  status: text("status").notNull(), // running | done | failed
  error: text("error"),
  verdict: text("verdict"), // the grader's last word: satisfied | max_iterations_reached | …
  costCents: integer("cost_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
