import { eq } from "drizzle-orm";
import { getDb, brands, settings } from "./db";
import { brandGmail, connection, connectionSecret, markConnection } from "./connections";
import { GmailError, gmailUnseen, parseKey } from "./gmail";

// How many unread mails wait under the label the boss chose for a brand, refreshed by the poll at most every
// five minutes, so the home page can offer "Đọc thư" without opening a mailbox on every render.

export type MailNews = { n: number; label: string; at: string };
const key = (sid: string) => `${sid}:gmail_unseen`;

export async function mailNews(sid: string): Promise<MailNews | null> {
  const db = await getDb();
  const [r] = await db.select().from(settings).where(eq(settings.key, key(sid)));
  return r ? (JSON.parse(r.value) as MailNews) : null;
}

export async function refreshMail(sid: string, maxAgeMs = 5 * 60 * 1000): Promise<MailNews | null> {
  const db = await getDb();
  const gmail = await connection("gmail");
  const [b] = await db.select().from(brands).where(eq(brands.id, sid));
  const label = b ? brandGmail(b).label : null;
  if (!gmail || gmail.status === "error" || !label) {
    await db.delete(settings).where(eq(settings.key, key(sid)));
    return null;
  }
  const have = await mailNews(sid);
  if (have && have.label === label && Date.now() - new Date(have.at).getTime() < maxAgeMs) return have;
  const secret = await connectionSecret("gmail");
  if (!secret) return null;
  try {
    const n = await gmailUnseen(parseKey(secret), label);
    const news: MailNews = { n, label, at: new Date().toISOString() };
    await db.insert(settings).values({ key: key(sid), value: JSON.stringify(news) }).onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(news) } });
    return news;
  } catch (e) {
    if (e instanceof GmailError && e.kind === "auth") await markConnection("gmail", false, "Gmail từ chối mật khẩu ứng dụng, dán lại");
    return have;
  }
}
