import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// One owner, one password (APP_PASSWORD). No password set = open, for local dev.
const COOKIE = "office_auth";

function token(): string {
  return createHmac("sha256", process.env.APP_PASSWORD ?? "").update("office").digest("hex");
}

export async function isAuthed(): Promise<boolean> {
  if (!process.env.APP_PASSWORD) return true;
  const c = await cookies();
  return c.get(COOKIE)?.value === token();
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) redirect("/login");
}

export async function login(password: string): Promise<boolean> {
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) return false;
  const c = await cookies();
  c.set(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90, path: "/" });
  return true;
}
