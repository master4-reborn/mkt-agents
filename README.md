# marketing-agent-team

A one-person marketing team of AI employees, modeled on solomi's "Series AI Agent" (TikTok @_solouniverse), running hosted on Anthropic Managed Agents. Nothing runs on this Mac: this folder is the source code and config that gets synced to the platform and, from phase 2, deployed as a web app.

Spec: https://claude.ai/artifact/VgEDKvWC67ABm8bdrqomdJ

## Phase 1 (this): the team as files

| Path | What |
| --- | --- |
| `agents/lead.md` | The coordinator (điều phối). Runs the weekly cycle, delegates, reports. Roster: the four employees below. |
| `agents/research.md` | Research employee. The only one with web search and fetch. Writes `research/`. |
| `agents/writer.md` | Writer. Drafts into `content/drafts/`. No web, no bash. |
| `agents/qa.md` | QA-QC. Sets `status: ready` or `needs-fix` plus a checklist. No web, no bash. |
| `agents/metrics.md` | Metrics. Turns a CSV in `reports/` into `reports/<week>.md`. |
| `environments/cloud.yaml` | The sandbox container (Anthropic cloud, unrestricted egress for now). |
| `HOUSE_RULES.md` | The eight nội quy. Master copy; each agent prompt repeats the ones that bind it. |
| `brand/BRAND.md` | Your brand card. Fill it in; it is mounted into the session on start. |
| `prompts/` | The first-run and weekly kickoff messages. |
| `scripts/` | `start-office.sh`, `run-week.sh`, `say.sh`, `watch.sh` (see below). |
| `claude-lock.json` | Written by `ant apply`; maps each file to its platform ID. Commit it. |

Agent frontmatter = the Managed Agents agent config; the Markdown body = its system prompt. Edit a file, run `ant apply` again, and the agent gets a new version.

## Run it

```sh
brew install anthropics/tap/ant          # once
ant auth login                           # once; opens a browser, no API key to store
ant apply --dry-run -v agents environments   # read the plan
ant apply agents environments            # create the 5 agents and the environment
scripts/start-office.sh                  # one session = the office; mounts BRAND.md, sends first-run
scripts/watch.sh                         # stream what the team is doing (Ctrl-C to stop)
scripts/run-week.sh "tuần này tập trung vào matcha"   # Monday
scripts/say.sh "approve content/drafts/2026-11-02-matcha-sang.md"
```

Outputs land in `/mnt/session/outputs/<week>/` inside the session; read them in the Console session view (Resources tab) or via `ant beta:files list`. Phase 2 replaces this with a web page.

## Decisions

- **One long-lived session is the office.** The sandbox keeps `research/`, `content/`, `reports/` between weeks. `BUDGET_CENTS` (default 1000 = 10 USD) is a hard list-price cap on the session; raise it with `ant beta:sessions update` when it pauses with `budget_reached`.
- **Models:** lead on Claude Opus 5.5, employees on Claude Sonnet 5.5. Change in the frontmatter.
- **Permissions:** file tools under the platform's `auto` policy; web only on research; bash off for writer and QA. There are no sending tools at all in phase 1, so rules 1 and 3 cannot be broken yet. Phase 3 adds Gmail/Notion/Drive via MCP with `always_ask` on anything that sends.
- **Networking:** `unrestricted` because research needs the open web. Tighten to `limited` + `allowed_hosts` once the competitor list is stable.
- **Language:** prompts in English with the Vietnamese terms the creator uses; the team writes content in Vietnamese per BRAND.md.

## Next phases

2. Web app (Next.js) that shows drafts, research and reports from the session and has an Approve / Reject button that sends the message for you.
3. Gmail, Notion and Drive through MCP, credentials in a vault, approval gate on every sending tool; weekly schedule as a deployment.
4. Design, Publish and Reply employees.
