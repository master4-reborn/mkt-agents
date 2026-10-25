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

Local dev needs no database and no API key: it uses PGlite (a Postgres in `../.office/pg`, outside the project so Turbopack does not rebuild on every write) and the `ant auth login` profile. The session in `../.office/session_id`, if any, becomes the first brand.

To use it from your phone on the same Wi-Fi, run `pnpm dev -H 0.0.0.0` and open `http://<the Mac's IP>:3000`.

## Brands

Each brand is one office session with the same team: its own workspace, conversation, posts and budget cap. The switcher at the top of every page changes which one you look at; `/brand/new` opens a new session from one sentence (the lead agent and environment come from `../claude-lock.json`, or `OFFICE_AGENT_ID` and `OFFICE_ENV_ID`).

## Deploy (Vercel + Supabase, Singapore)

1. Push this repo to GitHub.
2. Supabase: new project in Singapore, copy the Postgres connection string (Transaction pooler, port 6543).
3. Vercel: import the repo, **Root Directory = `web`**, region Singapore (`sin1`, set in `vercel.json`). Environment variables:
   - `ANTHROPIC_API_KEY`: an API key from the Console, in the same workspace as the agents (`claude-lock.json`, `origin.workspace_id`); the login profile does not exist on Vercel
   - `OFFICE_AGENT_ID`, `OFFICE_ENV_ID`: from `claude-lock.json` (`./agents/lead.md` and `./environments/cloud.yaml`), so the app can open a session for a new brand
   - `OFFICE_SESSION_ID`: optional, the session from `.office/session_id` to carry over as the first brand
   - `ANTHROPIC_WORKSPACE_ID`: for the Console link
   - `APP_PASSWORD`: the page's password
   - `DATABASE_URL`: Supabase
4. Deploy. Open the URL on your phone, log in, add a brand or approve a draft.

The production build has been checked against a real Postgres 17 (`next build` then `next start` with `DATABASE_URL`): the schema is created on first request, and an existing session is migrated into the first brand.

## Pages

| Page | What |
| --- | --- |
| `/` | What needs you today (posts to publish, holes to fill, numbers to send, replies to paste), the week's steps, the team, Run week |
| `/drafts` | Drafts by status; a draft page shows the post, Approve / Reject with a note, and the sources and QA checklist |
| `/research` | Topics, pains and competitors per week; ask for one more post from a topic |
| `/reports` | Enter each published post's numbers; the metrics report per week |
| `/brand`, `/brand/new` | The current card, edits by sentence; open an office for another brand |
| `/chat` | The conversation with the lead; send any order |
| `/api/status` | Polled by the page: syncs new files and messages, returns status and cost |
