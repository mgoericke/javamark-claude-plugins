# iteration-lab — design

Status: draft for Mark's approval · 5 Nov 2026

## Intent

A reusable Claude Code plugin that develops an existing application further in **rounds**: each
round ships one bold, innovative idea, and the application stays runnable after every round. It is
for projects where Mark no longer quite knows how to go on — the lab scans what is there, proposes,
builds, checks and shows every step.

It generalises what worked in the Rasen-Radar lab (`rasenradar-lab/LAB.md`, 102 rounds, a large
part ported to the real product) and fixes what did not:

| Rasen-Radar lab | iteration-lab |
|---|---|
| 100 rounds in one go; Mark's key corrections came mid-run | the user picks rounds per block and number of blocks; the lab stops after each block for feedback |
| product rules (data first, no prediction game, AI one click away) arrived late, rounds drifted | a short **compass** interview before round 1; every idea is checked against it |
| features piled up, the last days were spent decluttering | usability is a guardrail (measured), the last round of each block is a tidy-up round |
| `ship.sh` measured Lighthouse, CLS and sizes — regressions showed early | kept and generalised: hard checks, revert when they fail |
| frozen snapshot folder per round, clickable | one git commit + tag per round; the dashboard starts any round on demand |

## Goals

- **Two modes**
  - **invent** (default): each round one new, bold idea. Bold = a user would notice it at once or
    behave differently. No polish-only rounds (except the planned tidy-up round).
  - **modernize**: a separate mode. Behaviour must *not* change. Block 1 records the current
    behaviour (characterisation checks), then each round is one migration step from a roadmap
    (e.g. "Tomcat WAR → Quarkus, cloud-ready"), every characterisation check green after each step.
- **Blocks**: at the start the user chooses rounds per block and number of blocks (e.g. 3 × 5).
  After each block the lab stops, summarises (what shipped, best ideas, metric trend, cost) and asks
  whether to continue, change the compass, or stop.
- **Scan**: before each block the lab looks at the application with what is available — Playwright
  walk through the routes (screenshots desktop + 390 px, console errors), code reading, OpenAPI /
  REST resources, README / CLAUDE.md, git history. For web UIs it inventories the data the backend
  offers and how much of it the UI uses; ideas that put unused data to work are preferred, a new
  endpoint is allowed when the UI needs it.
- **Guardrails** keep quality and runnability (see below). A round that fails a hard guardrail is
  fixed within the round or reverted — the branch never holds a broken round.
- **Dashboard**: a local server, opened at the start of a run.
  - top bar: usage so far (input / output / cache tokens, per model), models used, run state
  - left: the rounds (number, title, mode, status, guardrail result)
  - main area: the selected round's application, running, in an iframe; fallback: its screenshots
  - overlay (toggle): what changed in that round — a visual diff against the previous round's
    screenshots, plus the changed files
  - per round: the idea, why, what was checked, cost of the round
- **Reusable**: works in any git repository; nothing project-specific in the plugin. All run data
  lives in the target repo under `.lab/`.
- **Supported targets**: web UIs first (static sites, SPAs, server-rendered apps). Backend services
  are supported for scanning, guardrails (HTTP smoke checks) and the round log; their dashboard
  main area shows changed endpoints and files instead of a UI.

## Non-goals (v1)

- No automatic push, PR or merge. The lab works on a local branch; publishing stays the user's call.
- No hosted service, no accounts; the dashboard binds to localhost.
- No cost in euros as a fact: tokens are exact, a cost figure is an estimate from a price table the
  user can edit.
- No full UI preview for backend services; no multi-repo runs.

## Anti-goals (a failure even if it technically works)

- A round leaves the application not starting, or a page broken.
- The application gets more cluttered every round (Rasen-Radar: buttons before matches).
- Ideas ignore the compass (e.g. betting language in a product that rules it out).
- The lab invents data, testimonials or user numbers.
- Modernize mode changes behaviour the user did not ask to change.

## How it works

### Commands

| Command | What it does |
|---|---|
| `/lab-init` | Interview: target (repo, how to build, test and start it, URL / routes), mode, rounds per block, blocks, compass (product principles, no-gos, audience), and for modernize the target stack. Detects stack and commands where it can and asks only for the rest. Writes `.lab/lab.json` and `.lab/COMPASS.md`, takes the baseline (round 0: scan + guardrail metrics + screenshots), creates the branch `lab/<run-name>`. |
| `/lab-run` | Runs the next block. Starts the dashboard if it is not running. |
| `/lab-dashboard` | Starts (or reopens) the dashboard. |
| `/lab-status` | Short text status: block, round, guardrails, usage. |
| `/lab-triage` | After the last block: every round as keep / adapt / drop with a reason, written to `.lab/TRIAGE.md` — the hand-off for porting to the real product (Rasen-Radar: triage → user stories). |

### Who runs a round

The main session orchestrates a block; **each round runs as its own subagent** with a fresh context
(idea, build, guardrails, ship), so a block of any length fits. The round subagent gets the compass,
the round log tail, the latest scan and its round number. As in the Rasen-Radar lab, scanning and
measuring may go to a cheaper model; choosing the idea and building it stay with the main model.
The main session checks each round's `summary.json` before starting the next and stops the block
early if a round could not be shipped or reverted cleanly.

### One round (invent)

1. Read the compass, the round log tail and the latest scan.
2. Choose one idea not done yet; write title, why, and which compass rules it serves.
3. Build it.
4. Run the guardrails. On failure: fix (bounded attempts) or `git reset` to the round's start and
   log the round as reverted with the reason.
5. Ship: commit, tag `lab-<run>-r<NNN>`, store screenshots, metrics and `summary.json`, append the
   changelog.

The last round of each block is a **tidy-up round**: no new feature; it reduces clutter and quality
debt measured since the block started.

### One round (modernize)

Modernize starts with a **setup block** that does not count against the chosen rounds: scan,
characterisation checks (Playwright walks of the main flows, recorded HTTP responses of the
endpoints) and `.lab/ROADMAP.md`. It ends with a stop where the user confirms or edits the roadmap.
Then the chosen blocks run; each round is the next roadmap step, and the characterisation checks are
hard guardrails. The tidy-up round in modernize is code-level only (dead code, duplication, build
warnings) and must not change behaviour.

### Guardrails

Hard guardrails are **relative to round 0**: a project that needs the lab may already have failing
tests, console errors or a page that scrolls sideways. `/lab-init` records these as known issues and
shows them; a round may not add new ones (and may fix old ones). If the app does not build or start
at all, `/lab-init` stops and says so — the lab needs a running baseline.

Hard (must pass, else fix or revert):

- build and test commands from `lab.json` exit 0
- the app starts with its start command and answers on its URL
- Playwright smoke: every configured route loads, no console errors, no horizontal scrolling at
  390 px; for backends: every configured endpoint answers with the expected status
- modernize: all characterisation checks green
- no regression beyond thresholds against round 0, where measurable: Lighthouse performance and
  accessibility, CLS (thresholds in `lab.json`, defaults: −5 points, +0.05 CLS)

Soft (logged and shown, trigger the tidy-up round):

- usability: where the main content starts on a 390 px screen (pixels from top), number of
  controls above it
- bundle / page sizes against round 0
- the agent's own check of the idea against the compass, quoted in the round summary

### Run data in the target repo

```
.lab/
  lab.json            config: commands, routes, mode, blocks, thresholds
  COMPASS.md          product principles from the interview
  ROADMAP.md          modernize only
  CHANGELOG.md        one entry per round
  rounds/r000…/       summary.json, screenshots, metrics, diff images
  dashboard.log
```

`.lab/` is committed on the lab branch so every round's record travels with its code.

### Dashboard

- Node server without a build step (`node server.mjs`), vanilla HTML/JS, localhost only.
- Starting a round's application: a git worktree per round tag (cached under `.lab/worktrees/`, git
  ignored). `/lab-init` asks for an optional setup command (e.g. `npm ci`) and a start command with a
  `{port}` placeholder or `PORT` variable; at most two rounds run at a time, oldest stopped first.
  Static sites are served directly. This is best effort: if a round does not start (shared database,
  fixed port, long build), the main area shows its screenshots and the reason.
- Usage: read from Claude Code's session transcripts (`~/.claude/projects/*/…jsonl`, including the
  subagent transcripts beside them): per assistant message timestamp, model and token usage. The
  session is not found by folder name — the session may run outside the repo (e.g. the desktop app's
  scratch workspaces). Instead `/lab-init` and each block print a unique run marker; `usage.mjs`
  finds the transcript files that contain it, records their paths in `.lab/lab.json`, and sums
  usage per round by the round's start and end time from `summary.json`. Unrelated parallel sessions
  are never counted.
- Overlay: per route and viewport the screenshot of the round with the changed pixels against the
  previous round highlighted (pixel diff), toggled with one button; plus `git diff --stat`.

### Plugin layout

```
plugins/iteration-lab/
  .claude-plugin/plugin.json
  README.md
  commands/  lab-init.md  lab-run.md  lab-dashboard.md  lab-status.md  lab-triage.md
  skills/iteration-lab/SKILL.md        the loop protocol, both modes, guardrail rules
  references/  compass-interview.md  idea-rules.md  modernize-playbook.md  round-summary-schema.md
  scripts/     package.json  scan.mjs  check.mjs  ship.mjs  usage.mjs
  dashboard/   server.mjs  index.html  app.js  app.css
```

Node dependencies (Playwright, pixelmatch, pngjs; Lighthouse optional) are installed once by
`/lab-init` into a persistent per-user folder (`~/.cache/iteration-lab/<plugin version>/`), because a
plugin update replaces the plugin folder; Playwright's Chromium is reused when present.

## Constraints

- Plugin repo conventions: `plugins/<name>/` with `.claude-plugin/plugin.json`, skills, commands,
  references; registered in `.claude-plugin/marketplace.json` and the README. Repo language English.
- Never push, merge or delete branches; the user does that (Mark's standing rule).
- Runs in Claude Code on macOS and Linux with Node ≥ 20 and git.

## Decided by Mark

- Blocks instead of one long run; the user is asked for rounds and blocks.
- Modernize is its own mode.
- Built as a plugin in `mgoericke/javamark-claude-plugins`, delivered as a pull request.
- Start with web UIs; backend services and new apps later.
- Dashboard with usage, models, round navigation, round state in the main area, change overlay.

## My calls (Claude) — open for Mark to change

- Plugin name `iteration-lab`, commands `/lab-*`.
- Tidy-up round as the last round of each block.
- Git tag per round + worktrees for the dashboard instead of copied snapshot folders.
- Visual pixel diff as the overlay (a DOM-level diff is out of scope for v1).
- Usage from session transcripts; cost only as an editable estimate.
- Each round runs as a subagent; scanning and measuring may use a cheaper model.
- Hard guardrails relative to round 0 (known issues recorded, no new ones); no start without a
  runnable baseline.
- Modernize: a setup block outside the chosen rounds; tidy-up there is code-level only.
- Usage found by a run marker in the transcripts, not by folder name.
- Old rounds of server apps in the dashboard are best effort, with screenshots as fallback.
- Node dependencies in `~/.cache/iteration-lab/`.
- Pilot: after the plugin PR, one short run (1 block × 2 rounds) on a local clone of the real
  Rasen-Radar repo, on a local branch, to prove it end to end; nothing is pushed.

## Left to the builder

- Exact wording of the skill and commands, the dashboard's look (plain, readable, light and dark).
- Route discovery details (sitemap, links, framework routes) and defaults for thresholds.
- How many fix attempts before a revert (suggested: 3).
