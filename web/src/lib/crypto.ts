import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// The keys the boss pastes (Notion secret, Gmail app password, Drive key) are sealed with AES-256-GCM under CONNECT_KEY
// before they reach the database. Local dev without CONNECT_KEY uses a fixed key: fine for the PGlite file, never for Vercel.
function key(): Buffer {
  const raw = process.env.CONNECT_KEY;
  if (raw) {
    const b = Buffer.from(raw, "base64");
    return b.length === 32 ? b : createHash("sha256").update(raw).digest();
  }
  if (process.env.DATABASE_URL) throw new Error("Set CONNECT_KEY (32 random bytes, base64) before storing connection keys.");
  return createHash("sha256").update("office-dev-connect-key").digest();
}

export function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function unseal(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const randomToken = () => randomBytes(32).toString("base64url");
