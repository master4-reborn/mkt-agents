import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, brands } from "./db";
import { requireAuth } from "./auth";
import { legacySessionId, openOffice, reopenOffice, knownStatus } from "./office";
import { currentFiles } from "./sync";
import { brandName } from "./parse";
import { markAttached, mcpAgent } from "./connections";

// A brand is an office of its own: one Managed Agents session with the same team.
export type Brand = { id: string; sentence: string; memoryStoreId: string | null; slug: string | null; schedule: string | null; notionRead: string | null; notionSave: string | null; createdAt: Date };

const COOKIE = "office_brand";

// Upgrade path: the one session the app used before brands existed becomes the first brand,
// and everything already synced from it is stamped with its id.
export async function ensureBrands(): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: brands.id }).from(brands).limit(1);
  if (rows.length) return;
  const legacy = legacySessionId();
  if (!legacy) return;
  await db.insert(brands).values({ id: legacy, sentence: "Thương hiệu đầu tiên" }).onConflictDoNothing();
  for (const t of ["files", "decisions", "messages", "activity"]) {
    await db.execute(sql.raw(`update ${t} set brand = '${legacy}' where brand = ''`));
  }
  await db.execute(sql`update settings set key = ${legacy} || ':' || key where key in ('office_status', 'synced_at', 'events_cursor_v2', 'threads')`);
}

export async function allBrands(): Promise<Brand[]> {
  const db = await getDb();
  return db.select().from(brands).orderBy(brands.createdAt);
}

// The brand the boss is looking at: the one in the cookie, else the oldest. Null until the first brand exists.
export async function currentBrand(): Promise<Brand | null> {
  const all = await allBrands();
  if (all.length === 0) return null;
  const want = (await cookies()).get(COOKIE)?.value;
  return all.find((b) => b.id === want) ?? all[0];
}

// Pages about a brand: signed in and a brand chosen, else off to make the first one.
export async function requireBrand(): Promise<Brand> {
  await requireAuth();
  const b = await currentBrand();
  if (!b) redirect("/brand/new");
  return b;
}

export async function setCurrentBrand(id: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
}

// Opens a new office and remembers it as a brand. The team starts on the brand card at once.
export async function createBrand(sentence: string, budgetUsd: number): Promise<Brand> {
  // Born with the app's read endpoint when a storage is connected (lib/connections.ts).
  const overrides = await mcpAgent().catch(() => null);
  const o = await openOffice(sentence, budgetUsd, overrides);
  const db = await getDb();
  const [row] = await db.insert(brands).values({ id: o.id, sentence, memoryStoreId: o.memoryStoreId, slug: o.slug }).returning();
  if (overrides) await markAttached(o.id);
  return row;
}

// A new session for a brand whose office stopped, on the same memory stores. Everything synced from the old session
// is re-stamped with the new id so the pages show one continuous history; the old event cursor is dropped.
export async function reopenBrand(b: Brand, budgetUsd: number): Promise<Brand> {
  const card = (await currentFiles(b.id, "brand"))[0]?.content ?? null;
  const overrides = await mcpAgent().catch(() => null);
  const o = await reopenOffice(b, budgetUsd, card, overrides);
  const db = await getDb();
  for (const t of ["files", "decisions", "messages", "activity", "mirrors"]) {
    await db.execute(sql`update ${sql.raw(t)} set brand = ${o.id} where brand = ${b.id}`);
  }
  await db.execute(sql`delete from settings where key in (${`${b.id}:events_cursor_v2`}, ${`${b.id}:threads`}, ${`${b.id}:office_status`})`);
  await db.execute(sql`update settings set key = ${o.id} || substr(key, ${b.id.length + 1}) where key like ${`${b.id}:%`}`);
  const [row] = await db.update(brands).set({ id: o.id, memoryStoreId: o.memoryStoreId ?? b.memoryStoreId, slug: o.slug ?? b.slug }).where(eq(brands.id, b.id)).returning();
  if (overrides) await markAttached(o.id);
  return row;
}

// Monday mornings the cron (`/api/cron/week`) sends this brand "Chạy tuần mới", or stops doing so.
export async function setSchedule(id: string, on: boolean): Promise<void> {
  const db = await getDb();
  await db.update(brands).set({ schedule: on ? "mon" : null }).where(eq(brands.id, id));
}

export type BrandSummary = Brand & { name: string; waiting: number; running: boolean };

// For the switcher: every brand with its name, how many posts wait for the boss and whether its team is busy.
export async function brandSummaries(): Promise<BrandSummary[]> {
  const all = await allBrands();
  return Promise.all(
    all.map(async (b) => {
      const [card, drafts, status] = await Promise.all([currentFiles(b.id, "brand"), currentFiles(b.id, "draft"), knownStatus(b.id).catch(() => null)]);
      return {
        ...b,
        name: (card[0] && brandName(card[0].content)) || shortSentence(b.sentence),
        waiting: drafts.filter((d) => d.status === "ready").length,
        running: status?.status === "running",
      };
    }),
  );
}

export function shortSentence(s: string): string {
  const t = s.trim();
  return t.length > 30 ? `${t.slice(0, 28).trimEnd()}…` : t;
}
