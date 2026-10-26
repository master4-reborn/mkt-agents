# marketing-agent-team

A one-person marketing team of AI employees, modeled on solomi's "Series AI Agent" (TikTok @_solouniverse), running hosted on Anthropic Managed Agents. Nothing runs on this Mac: this folder is the source code and config that gets synced to the platform and, from phase 2, deployed as a web app.

Spec (final v1): https://claude.ai/artifact/QPnbQhz1UXPs6nY5vqMHYG

## Phase 1 (this): the team as files

| Path | What |
| --- | --- |
| `agents/lead.md` | The coordinator (điều phối). Plans each week (goal, post mix, one test, plans/<week>-plan.md), picks research's topics to fit it, runs the weekly cycle, delegates, reports. Roster: the four employees below. |
| `agents/research.md` | Research employee. The only one with web search and fetch. Writes `research/`. |
| `agents/writer.md` | Writer. Drafts into `content/drafts/`. No web, no bash. |
| `agents/qa.md` | QA-QC. Sets `status: ready` or `needs-fix` plus a checklist. No web, no bash. |
| `agents/metrics.md` | Metrics. Turns a CSV in `reports/` into `reports/<week>.md`. |
| `agents/scout.md` | Skill scout, outside the team (not in the lead's roster). Searches the web and proposes one skill per run for the boss to approve; the web app starts it and delivers approved skills into memory. |
| `environments/cloud.yaml` | The sandbox container (Anthropic cloud, unrestricted egress for now). |
| `HOUSE_RULES.md` | The eight nội quy. Master copy; each agent prompt repeats the ones that bind it. |
| `brand/BRAND.md` | The brand card template. You do not have to fill it: `scripts/new-brand.sh "<one sentence>"` makes the team write it. A filled copy here is mounted on start instead. |
| `prompts/` | The first-run and weekly kickoff messages. |
| `scripts/` | `start-office.sh`, `new-brand.sh`, `update-brand.sh`, `run-week.sh`, `say.sh`, `watch.sh` (see below). |
| `claude-lock.json` | Written by `ant apply`; maps each file to its platform ID. Commit it. |

Agent frontmatter = the Managed Agents agent config; the Markdown body = its system prompt. Edit a file, run `ant apply` again, and the agent gets a new version. A running office keeps the version it opened with; the web app sends the lead's new text along with that office's next order (workers are not updated this way).

## Run it

```sh
brew install anthropics/tap/ant          # once
ant auth login                           # once; opens a browser, no API key to store
ant apply --dry-run -v agents environments   # read the plan
ant apply agents environments            # create the 5 agents and the environment
scripts/start-office.sh                  # one session = the office; sends first-run
scripts/new-brand.sh "bán matcha cho dân văn phòng, đăng Threads"   # the team writes brand/BRAND.md itself
scripts/watch.sh                         # stream what the team is doing (Ctrl-C to stop)
scripts/run-week.sh "tuần này tập trung vào matcha"   # Monday
scripts/say.sh "approve content/drafts/2026-11-02-matcha-sang.md"
```

Outputs land in `/mnt/session/outputs/` inside the session and show up on the office page (`web/`). `scripts/show.sh content/drafts` prints them in the terminal instead.

## Decisions

- **One long-lived session is the office.** The sandbox keeps `research/`, `content/`, `reports/` between weeks. `BUDGET_CENTS` (default 1000 = 10 USD) is a hard list-price cap on the session; raise it with `ant beta:sessions update` when it pauses with `budget_reached`.
- **Models:** lead on Claude Opus 5.5, employees on Claude Sonnet 5.5. Change in the frontmatter.
- **Permissions:** file tools under the platform's `auto` policy; web only on research; bash off for writer and QA. There are no sending tools at all in phase 1, so rules 1 and 3 cannot be broken yet. Phase 3 adds Gmail/Notion/Drive via MCP with `always_ask` on anything that sends.
- **Networking:** `unrestricted` because research needs the open web. Tighten to `limited` + `allowed_hosts` once the competitor list is stable.
- **Language:** prompts in English with the Vietnamese terms the creator uses; the team writes content in Vietnamese per BRAND.md.

## Phase 2: the office page

`web/` is a Next.js app: dashboard, drafts with Approve / Reject, research, reports, brand, chat. See `web/README.md` to run it locally (`cd web && pnpm dev`) and to deploy it on Vercel with Supabase.

The lead copies every file it creates or changes to `/mnt/session/outputs/`; the page pulls those through the Files API, so nothing in the sandbox is ever reached directly.

## Next phases

3. Gmail, Notion and Drive through MCP, credentials in a vault, approval gate on every sending tool; weekly schedule as a deployment.
4. Design, Publish and Reply employees.
