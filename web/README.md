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

## Memory

The team learns through two Managed Agents memory stores mounted into every office: the boss's shared store (`memory_stores/sep.yaml`, applied with `ant apply`, read from `../claude-lock.json` or `OFFICE_MEMORY_ID`) and one store per brand, created by the app when the office opens. Only the lead writes them, at the moments listed under "Bộ nhớ" in `agents/lead.md`. The Thương hiệu page shows every line (Đội đã học for the brand, Sở thích của sếp for all brands) with delete and add; the poll mirrors the stores into the `memories` table. A stopped office (budget reached) is reopened from that page on the same stores. An office opened before the store existed has no memory until it is reopened.

## Schedule

`vercel.json` declares one cron: every Monday 01:00 UTC (08:00 Việt Nam; Hobby plan fires within the hour) Vercel calls `/api/cron/week` with `Authorization: Bearer $CRON_SECRET`. The route sends the same "Chạy tuần mới" order the home button sends to every brand whose `schedule` is on (the "Lịch chạy tuần" card on the Thương hiệu page), skipping a brand that already ran this week, whose team is busy, or whose office stopped. Off by default. Nothing fires locally.

## Connections (phase 5: Nguồn và lưu trữ)

The team reads the internet by default. From the Thương hiệu page the boss can connect storages by pasting a key, no login screen: today Notion (an internal integration secret), later Gmail and Drive. A connected storage is read by the team and receives copies of what the team delivers.

- Keys are sealed with AES-256-GCM under `CONNECT_KEY` before they reach the `connections` table (`src/lib/crypto.ts`); local dev without the variable uses a fixed key.
- The team reads through one read-only MCP endpoint of this app, `/api/mcp` (JSON-RPC over POST; tools `notion_query`, `notion_page`, `notion_search`). The endpoint is declared on every office as an MCP server named `nguon`, with a bearer kept as a `static_bearer` credential in the boss's vault (`vaults/sep.yaml`) and as a hash in `settings`. The vault credential is keyed by the endpoint URL, so the app needs its public address: `APP_URL`, or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`. Locally there is no public address and nothing is attached.
- An office gets the endpoint through `sessions.update` (only while idle; a busy office is marked pending and the poll retries) or at birth (`agent_with_overrides`). The lead's own tools are read from the agent and sent back with the MCP toolset, because the update replaces the whole list.
- Per brand, the boss chooses one Notion database to read ("Đọc") and one page to save under ("Lưu vào"). The app creates three databases under that page (Bài đã duyệt, Báo cáo tuần, Thẻ thương hiệu; columns Tên, Thương hiệu, Tuần, Ngày, Trạng thái, Tệp) and, from the poll, saves each approved post, weekly report and ready brand card once (`mirrors` table, `src/lib/mirror.ts`). The agents never write outside the office.
- Gmail (`src/lib/gmail.ts`, `imapflow` + `nodemailer`): the boss pastes their address and a Google app password; the app checks it with one IMAP login and remembers the labels. Per brand, one label the team reads (tools `gmail_search`, `gmail_read`; reading marks the mail read) and a switch, off by default, that mails each approved post once from the boss's address to the same address (`mirrors` rows with target `gmail`). The poll caches the unread count under the brand's label at most every five minutes (`src/lib/mailbox.ts`); the home page shows it as a task whose button sends the lead "Đọc thư mới…".
- Drive (`src/lib/drive.ts`, no library: a signed JWT swapped for a one-hour token): the boss pastes a service account's JSON key and shares folders with the account's address; the app checks the key with one list call. Per brand, one folder the team reads (tools `drive_list`, `drive_read`: Docs, Sheets and Slides are exported as text, plain files downloaded). Read only by design: service accounts have no Drive storage of their own.
- `agents/lead.md` has a "Nguồn ngoài" section telling the lead when to read Notion, Gmail and Drive; apply it with `ant apply agents` so new offices get it; an office already open gets the new text with its next order.

## Skills (kỹ năng)

A scout (`agents/scout.md`, Sonnet 5.5, web search and fetch only) looks for proven marketing practice and proposes one skill per run; nothing reaches the team until the boss approves it (`src/lib/skills.ts`).

- Scopes: "shared" (every brand, the boss's store) or one brand (that brand's store; the scout also reads its card). Each run is its own session with a $4 budget and an outcome rubric (up to three grader rounds); it writes `skill.md` and `review.md` to its outputs. The poll collects them when the session stops (`scout_runs`), turns them into a proposed version and archives the session.
- `skills` and `skill_versions`: numbered versions, exactly one current per active skill; proposed → current → superseded, rejected kept with the boss's reason (the next run reads it). Approving or restoring makes a new number; approved text never changes. A newer proposal for the same skill replaces the older one.
- Delivery: the current text of each active skill goes to `/ky-nang/<slug>.md` in the scope's memory store, with `/ky-nang/index.md`. Every running office reads memory live; the lead's "Kỹ năng" section says when to read the index and how to hand a skill to an employee. The poll puts the files back if they drift from the database.
- Pages: Thương hiệu has "Kỹ năng riêng" (under Đội đã học) and "Kỹ năng chung" (under Sở thích của sếp) with proposals, skills in use (each with how many of this brand's posts used it), the "Tìm kỹ năng mới" button and the schedule; `/brand/skill/[id]` shows one version. A proposal opens with rules and their sources (two sources, or "chính thức" for one official source; one other source is yellow) and a bar pinned to the bottom: who receives it, Bỏ (quick reasons), Sửa (rules as text), Duyệt. A version in use opens with "Đã dùng" (posts by version, the boss's decisions on them, the latest posts), its text folded, Ngừng dùng or Dùng lại bản này, and the history. Hôm nay lists waiting proposals as a task and the plan card names the skills this week's drafts used.
- Usage: the writer tags each draft written with a skill `skills: <slug> v<version>` (lead's instructions); the app counts tagged drafts and replies per brand from the synced files. Engagement per skill is not measured yet.
- Duplicate topics: a proposal filed as a new skill that covers a skill in use (the scout names it under `similar` in review.md, or at least 2 rules and 40% of the proposal's rules share most words with that skill's rules, `compareRules`) shows "Giống: …". The boss chooses "Làm bản N của X" (default: the proposal becomes X's next version under X's name; X's rules the proposal lacks are listed and kept when ticked, with their sources renumbered; the empty new skill is removed) or "Giữ thành kỹ năng riêng".
- Schedule: per scope, Tắt / 2 tuần một lần / Mỗi tháng (default: shared monthly, brands off; Thêm thương hiệu asks for the brand's, default Tắt). A brand's scheduled run waits until its brand card is ready. `/api/cron/scout` runs daily at 02:00 UTC and starts each scope that is due, unless that scope is still running, still has a proposal waiting, or the month's scout spend would pass $20 (a running run counts at its $4 cap). The button ignores the schedule and the ceiling.
- The scout agent id comes from `OFFICE_SCOUT_ID`, or is found by name (`marketing-scout`) once and kept in `settings`.

## Deploy (Vercel + Supabase, Singapore)

1. Push this repo to GitHub.
2. Supabase: new project in Singapore, copy the Postgres connection string (Transaction pooler, port 6543).
3. Vercel: import the repo, **Root Directory = `web`**, region Singapore (`sin1`, set in `vercel.json`). Environment variables:
   - `ANTHROPIC_API_KEY`: an API key from the Console, in the same workspace as the agents (`claude-lock.json`, `origin.workspace_id`); the login profile does not exist on Vercel
   - `OFFICE_AGENT_ID`, `OFFICE_ENV_ID`: from `claude-lock.json` (`./agents/lead.md` and `./environments/cloud.yaml`), so the app can open a session for a new brand
   - `OFFICE_MEMORY_ID`: from `claude-lock.json` (`./memory_stores/sep.yaml`), the shared memory store
   - `OFFICE_VAULT_ID`: from `claude-lock.json` (`./vaults/sep.yaml`), the credential vault
   - `CRON_SECRET`: any long random string; Vercel sends it with the Monday cron call
   - `CONNECT_KEY`: 32 random bytes, base64 (`openssl rand -base64 32`); seals the storage keys the boss pastes
   - `APP_URL`: optional, the public address of the app for the office's MCP endpoint (defaults to the Vercel production URL)
   - `OFFICE_SESSION_ID`: optional, the session from `.office/session_id` to carry over as the first brand
   - `ANTHROPIC_WORKSPACE_ID`: for the Console link
   - `APP_PASSWORD`: the page's password
   - `DATABASE_URL`: Supabase
4. Deploy. Open the URL on your phone, log in, add a brand or approve a draft.

`next.config.ts` turns Turbopack's persistent build cache off: on Vercel it once reused the previous commit's stylesheet, so a CSS change did not reach production.

The production build has been checked against a real Postgres 17 (`next build` then `next start` with `DATABASE_URL`): the schema is created on first request, and an existing session is migrated into the first brand.

## Pages

| Page | What |
| --- | --- |
| `/` | What needs you today (posts to publish, holes to fill, numbers to send, replies to paste), the lead's plan for the week (goal, post mix, one test, the topics it picked, keep/drop every fourth week; from `<week>-plan.md`), the week's steps starting with Kế hoạch, the team, Run week |
| `/drafts` | Drafts by status; a draft page shows the post, Approve / Reject with a note, and the sources and QA checklist |
| `/research` | Topics, pains and competitors per week; ask for one more post from a topic |
| `/reports` | Enter each published post's numbers; the metrics report per week |
| `/brand`, `/brand/new` | The current card, edits by sentence; the Monday schedule on/off; sources and storage; what the team learned (per brand and for all brands), reopen a stopped office; open an office for another brand |
| `/brand/notion` | Connect Notion with a pasted secret; per brand, the database the team reads and the page the app saves under; last saves |
| `/brand/gmail` | Connect Gmail with an app password; per brand, the label the team reads and the copy-by-mail switch; last mails sent |
| `/brand/drive` | Connect Drive with a service account key; per brand, the shared folder the team reads |
| `/office` | The 3D island, full screen: order the lead from the composer, tap a cat for its card and a private order (sent as "Chuyển cho <role>: …"), tap a building to open its page; on a phone, Hôm nay has a window card into it |
| `/chat` | The conversation with the lead; send any order |
| `/api/status` | Polled by the page: syncs new files and messages, returns status and cost |
| `/api/cron/week` | Called by Vercel's cron on Monday mornings: starts the week for every brand with the schedule on |
| `/api/mcp` | The office's read-only MCP endpoint (bearer from the vault): Notion tools |
