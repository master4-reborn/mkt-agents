import { createSign } from "node:crypto";

// The boss's Google Drive through a service account key, read-only. The account sees only what the boss shared
// with its address. Google gives service accounts no Drive storage, so nothing is ever written there.

export type DriveKey = { client_email: string; private_key: string; project_id?: string };
export class DriveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export type DriveFile = { id: string; name: string; mimeType: string; url: string; modified: string };

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const API = "https://www.googleapis.com/drive/v3";

// The pasted JSON: only the two fields the token needs, so a stray paste of something else is refused early.
export function parseDriveKey(json: string): DriveKey {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(json.trim());
  } catch {
    throw new DriveError(400, "Không phải tệp JSON");
  }
  if (o.type !== "service_account" || typeof o.client_email !== "string" || typeof o.private_key !== "string") throw new DriveError(400, "Không phải khoá tài khoản dịch vụ");
  return { client_email: o.client_email, private_key: o.private_key, project_id: typeof o.project_id === "string" ? o.project_id : undefined };
}

// A signed JWT swapped for a one-hour access token, kept in memory until it is nearly due.
const tokens = new Map<string, { token: string; exp: number }>();
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export async function driveToken(k: DriveKey): Promise<string> {
  const have = tokens.get(k.client_email);
  if (have && have.exp - 120 > Date.now() / 1000) return have.token;
  const iat = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: k.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }));
  let sig: string;
  try {
    sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(k.private_key, "base64url");
  } catch {
    throw new DriveError(400, "Khoá riêng trong tệp không đọc được");
  }
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new DriveError(401, j.error_description || j.error || `Google từ chối khoá (${r.status})`);
  tokens.set(k.client_email, { token: j.access_token, exp: iat + (j.expires_in ?? 3600) });
  return j.access_token;
}

async function api<T>(k: DriveKey, path: string, params: Record<string, string>, raw = false): Promise<T> {
  const token = await driveToken(k);
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const reason = j.error?.errors?.[0]?.reason ?? "";
    const m = j.error?.message ?? `Google trả về ${r.status}`;
    if (r.status === 403 && (/accessNotConfigured/i.test(reason) || /has not been used|is disabled/i.test(m))) throw new DriveError(403, "Google Drive API chưa được bật trong dự án của khoá");
    throw new DriveError(r.status, m.replace(/\s+/g, " ").slice(0, 200));
  }
  return (raw ? await r.text() : await r.json()) as T;
}

// Ids from the links people paste: folders/<id>, file/d/<id>, open?id=<id>, or a bare id.
export function driveId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/(?:folders|d)\/([-\w]{10,})/) ?? s.match(/[?&]id=([-\w]{10,})/) ?? s.match(/^([-\w]{20,})$/);
  return m ? m[1] : null;
}

const FIELDS = "id,name,mimeType,webViewLink,modifiedTime";
const file = (f: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }): DriveFile => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.webViewLink ?? `https://drive.google.com/open?id=${f.id}`, modified: f.modifiedTime ?? "" });

export const isFolder = (f: { mimeType: string }) => f.mimeType === "application/vnd.google-apps.folder";

// Proves the key works: one list call. Enabling the API or sharing nothing still passes; sharing is checked per folder.
export async function driveCheck(k: DriveKey): Promise<void> {
  await api(k, "/files", { pageSize: "1", fields: "files(id)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
}

export async function driveGet(k: DriveKey, id: string): Promise<DriveFile> {
  return file(await api(k, `/files/${encodeURIComponent(id)}`, { fields: FIELDS, supportsAllDrives: "true" }));
}

// What is in a folder (newest first), or files anywhere the account can see whose name contains a word.
export async function driveList(k: DriveKey, o: { folder?: string; query?: string; limit?: number }): Promise<DriveFile[]> {
  const parts = ["trashed = false"];
  if (o.folder) parts.push(`'${o.folder.replace(/'/g, "\\'")}' in parents`);
  if (o.query?.trim()) parts.push(`name contains '${o.query.trim().replace(/'/g, "\\'")}'`);
  const j = await api<{ files: Parameters<typeof file>[0][] }>(k, "/files", { q: parts.join(" and "), orderBy: "folder,modifiedTime desc", pageSize: String(Math.min(Math.max(1, o.limit ?? 50), 200)), fields: `files(${FIELDS})`, supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  return (j.files ?? []).map(file);
}

const EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};
const PLAIN = /^(text\/|application\/(json|xml|x-yaml|csv))/;

// A file as text: Google Docs, Sheets and Slides are exported; plain files are downloaded; anything else is named, not read.
export async function driveRead(k: DriveKey, id: string): Promise<{ file: DriveFile; text: string | null }> {
  const f = await driveGet(k, id);
  if (isFolder(f)) return { file: f, text: null };
  if (EXPORT[f.mimeType]) return { file: f, text: await api<string>(k, `/files/${encodeURIComponent(id)}/export`, { mimeType: EXPORT[f.mimeType] }, true) };
  if (PLAIN.test(f.mimeType) || /\.(md|txt|csv|json)$/i.test(f.name)) return { file: f, text: await api<string>(k, `/files/${encodeURIComponent(id)}`, { alt: "media", supportsAllDrives: "true" }, true) };
  return { file: f, text: null };
}
