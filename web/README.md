# web — the office page

Next.js app that shows what the marketing team produced and lets you order work and approve drafts from your phone.

It reads the office session on Anthropic Managed Agents: files the lead copies to `/mnt/session/outputs/` (research, drafts, reports, the brand card) and the conversation with the lead. Approve / reject / run week are messages sent to the lead.

## Run locally

```sh
cd web
pnpm install
cp .env.example .env     # optional; everything has a dev default
pnpm dev                 # http://localhost:3000
```

Local dev needs no database and no API key: it uses PGlite (a Postgres in `.data/`) and the `ant auth login` profile, and reads the session id from `../.office/session_id`.

## Deploy (Vercel + Supabase, Singapore)

1. Push this repo to GitHub.
2. Supabase: new project in Singapore, copy the Postgres connection string (Transaction pooler, port 6543).
3. Vercel: import the repo, **Root Directory = `web`**, region Singapore (`sin1`). Environment variables:
   - `ANTHROPIC_API_KEY` (an API key from the Console; the login profile does not exist on Vercel)
   - `OFFICE_SESSION_ID` (from `.office/session_id`)
   - `ANTHROPIC_WORKSPACE_ID` (from `claude-lock.json`, `origin.workspace_id`)
   - `APP_PASSWORD` (the page's password)
   - `DATABASE_URL` (Supabase)
4. Deploy. Open the URL on your phone, log in, approve a draft.

## Pages

| Page | What |
| --- | --- |
| `/` | Status and cost, Run week, Run metrics, drafts waiting for you, the lead's last message |
| `/drafts` | Drafts by status; a draft page shows the post, Approve / Reject with a note, and the sources and QA checklist |
| `/research`, `/reports` | The team's files, rendered |
| `/brand` | New brand from one sentence; the current card; manual edit |
| `/chat` | The conversation with the lead; send any order or paste a CSV |
| `/api/status` | Polled by the page: syncs new files and messages, returns status and cost |
