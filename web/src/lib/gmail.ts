import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

// The boss's Gmail through an app password: IMAP to read mail under a label, SMTP to send copies to the same address.
// Every call opens one connection and closes it; nothing is cached here.

export type GmailKey = { address: string; password: string };
export class GmailError extends Error {
  constructor(public kind: "auth" | "label" | "other", message: string) {
    super(message);
  }
}
export type Mail = { uid: number; subject: string; from: string; date: string; unseen: boolean };

export const parseKey = (secret: string): GmailKey => JSON.parse(secret) as GmailKey;

function wrap(e: unknown): GmailError {
  if (e instanceof GmailError) return e;
  const err = e as { authenticationFailed?: boolean; responseText?: string; message?: string; code?: string };
  const text = (err.responseText || err.message || String(e)).replace(/\s+/g, " ").slice(0, 200);
  if (err.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Username and Password not accepted/i.test(text)) return new GmailError("auth", text);
  return new GmailError("other", text);
}

async function withImap<T>(k: GmailKey, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: k.address, pass: k.password }, logger: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000 });
  try {
    await c.connect();
  } catch (e) {
    throw wrap(e);
  }
  try {
    return await fn(c);
  } catch (e) {
    throw wrap(e);
  } finally {
    await c.logout().catch(() => {});
  }
}

// The labels the boss made, as Gmail shows them under IMAP: the inbox plus every label that is not a Gmail system folder.
export async function gmailLabels(k: GmailKey): Promise<string[]> {
  return withImap(k, async (c) => {
    const all = await c.list();
    return all.filter((m) => m.path === "INBOX" || (!m.path.startsWith("[Gmail]") && !m.specialUse)).map((m) => m.path).sort((a, b) => (a === "INBOX" ? -1 : b === "INBOX" ? 1 : a.localeCompare(b, "vi")));
  });
}

// The label's real path, case-insensitive, or a label error naming what exists.
async function findLabel(c: ImapFlow, label: string): Promise<string> {
  const want = label.trim().toLowerCase();
  if (!want || want === "inbox" || want === "hộp thư đến") return "INBOX";
  const all = await c.list();
  const hit = all.find((m) => m.path.toLowerCase() === want) ?? all.find((m) => m.name.toLowerCase() === want) ?? all.find((m) => m.path.toLowerCase().endsWith(`/${want}`));
  if (!hit) throw new GmailError("label", `Không có nhãn «${label}» trong Gmail`);
  return hit.path;
}

export async function gmailCheckLabel(k: GmailKey, label: string): Promise<string> {
  return withImap(k, (c) => findLabel(c, label));
}

export async function gmailUnseen(k: GmailKey, label: string): Promise<number> {
  return withImap(k, async (c) => {
    const path = await findLabel(c, label);
    const s = await c.status(path, { unseen: true });
    return (s && s.unseen) || 0;
  });
}

// Newest mails under a label, optionally only unread or only those containing a word.
export async function gmailSearch(k: GmailKey, o: { label?: string; query?: string; unseen?: boolean; limit?: number }): Promise<{ label: string; mails: Mail[] }> {
  return withImap(k, async (c) => {
    const path = await findLabel(c, o.label ?? "INBOX");
    const lock = await c.getMailboxLock(path);
    try {
      const q: Record<string, unknown> = { all: true };
      if (o.unseen) q.seen = false;
      if (o.query?.trim()) q.text = o.query.trim();
      const uids = ((await c.search(q, { uid: true })) || []) as number[];
      const pick = uids.sort((a, b) => b - a).slice(0, Math.min(Math.max(1, o.limit ?? 20), 100));
      const mails: Mail[] = [];
      if (pick.length) {
        for await (const m of c.fetch(pick, { uid: true, envelope: true, flags: true }, { uid: true })) {
          const env = m.envelope;
          const from = env?.from?.[0];
          mails.push({ uid: m.uid, subject: env?.subject || "(không tiêu đề)", from: from ? (from.name ? `${from.name} <${from.address}>` : from.address || "") : "", date: env?.date ? new Date(env.date).toISOString() : "", unseen: !m.flags?.has("\\Seen") });
        }
      }
      return { label: path, mails: mails.sort((a, b) => b.uid - a.uid) };
    } finally {
      lock.release();
    }
  });
}

type Node = { part?: string; type?: string; encoding?: string; parameters?: Record<string, string>; childNodes?: Node[] };

function textPart(n: Node): Node | null {
  if (n.type === "text/plain" && n.part) return n;
  for (const ch of n.childNodes ?? []) {
    const hit = textPart(ch);
    if (hit) return hit;
  }
  return null;
}
function htmlPart(n: Node): Node | null {
  if (n.type === "text/html" && n.part) return n;
  for (const ch of n.childNodes ?? []) {
    const hit = htmlPart(ch);
    if (hit) return hit;
  }
  return null;
}

async function readStream(s: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const ch of s) chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
  return Buffer.concat(chunks);
}

function decode(buf: Buffer, charset?: string): string {
  try {
    return new TextDecoder((charset || "utf-8").toLowerCase()).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

const stripHtml = (h: string) =>
  h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

// One mail's text. Reading it marks it read in Gmail, so the "thư mới" count on the home page goes down.
export async function gmailRead(k: GmailKey, uid: number, label?: string): Promise<{ subject: string; from: string; date: string; text: string }> {
  return withImap(k, async (c) => {
    const path = await findLabel(c, label ?? "INBOX");
    const lock = await c.getMailboxLock(path);
    try {
      const m = await c.fetchOne(String(uid), { uid: true, envelope: true, bodyStructure: true }, { uid: true });
      if (!m) throw new GmailError("other", `Không có thư số ${uid} trong nhãn «${path}»`);
      const root = m.bodyStructure as unknown as Node;
      const node = m.bodyStructure?.type === "text/plain" || m.bodyStructure?.type === "text/html" ? ({ ...root, part: root.part || "1" } as Node) : textPart(root) ?? htmlPart(root);
      let text = "";
      if (node?.part) {
        const { content } = await c.download(String(uid), node.part, { uid: true });
        const raw = content ? decode(await readStream(content), node.parameters?.charset) : "";
        text = node.type === "text/html" ? stripHtml(raw) : raw.trim();
      }
      await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
      const env = m.envelope;
      const from = env?.from?.[0];
      return { subject: env?.subject || "(không tiêu đề)", from: from ? (from.name ? `${from.name} <${from.address}>` : from.address || "") : "", date: env?.date ? new Date(env.date).toISOString() : "", text: text.slice(0, 60000) };
    } finally {
      lock.release();
    }
  });
}

// A copy to the boss's own address, never anywhere else.
export async function gmailSendSelf(k: GmailKey, o: { subject: string; text: string }): Promise<{ messageId: string }> {
  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: k.address, pass: k.password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000 });
  try {
    const r = await t.sendMail({ from: k.address, to: k.address, subject: o.subject, text: o.text });
    return { messageId: r.messageId };
  } catch (e) {
    const err = e as { responseCode?: number; message?: string };
    const text = (err.message || String(e)).replace(/\s+/g, " ").slice(0, 200);
    throw new GmailError(err.responseCode === 535 || /535|Username and Password not accepted/i.test(text) ? "auth" : "other", text);
  }
}
