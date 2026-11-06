---
name: evolve
description: Develop an existing application further in rounds, each round one bold idea, with measured guardrails, one git commit and tag per round, and a local dashboard. Two modes - invent (new ideas) and modernize (behaviour must not change). Use for /evolve start, next, board, status and review, or when the user wants a repository improved round by round on its own branch.
---

# evolve

evolve develops a git repository in **rounds** on a local branch `evolve/<run>`. Each round ships one idea, the app stays runnable,
and every round is one commit plus the tag `evolve-<run>-rNNN`. Rounds are grouped into **blocks**; evolve stops after each block.
All run data lives in the target repo under `.evolve/`. Scripts are called as `node "${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs" <repo> ...`. **`<repo>` is always the absolute path of the target repository, in every call and for every file path; the session may run outside the repo, so no step relies on the current directory.**

## Hard rules

- Never push, merge or delete branches. Publishing is the user's call.
- Never invent data, testimonials, reviews or user numbers.
- Each round needs a **clean git tree**. `init.mjs` and `check.mjs --start N` refuse a dirty tree. If the tree is dirty, stop and ask the user; do not stash, reset or commit their work on your own.
- Do not `git reset` by hand to revert a round. `ship.mjs` does that (see Revert).
- Do not edit scripts, the dashboard or `.evolve/rounds/*` by hand, except the files named in this skill.

## Files and scripts

| Path | Content |
|---|---|
| `.evolve/evolve.json` | config and run marker (see Config) |
| `.evolve/COMPASS.md`, `ROADMAP.md`, `CHANGELOG.md`, `TRIAGE.md` | compass, modernize roadmap, one entry per round, review result |
| `.evolve/rounds/rNNN/` | `start.txt`, `scan.json`, `metrics.json`, `guardrails.json`, `shots/`, `summary.json`, `diffs.json`, `diff/` |
| `.evolve/characterisation/` | modernize: recorded behaviour |
| `.evolve/usage.json` | token usage per round, written by `usage.mjs` |
| `.evolve/local/` | never committed: `dashboard.log`, `logs/app-rNNN.log` (dashboard apps), `logs/scan-rNNN.log` (scan), scratch summaries |
| `.evolve/worktrees/` | never committed: one git worktree per round for the dashboard |

`.evolve/local/` and `.evolve/worktrees/` are gitignored by `init.mjs`; they do not count as a dirty tree.

**Long-running commands.** `check.mjs --baseline`, `check.mjs --round N` and `ship.mjs` can take longer than Bash's 2-minute default. Call Bash with `timeout: 600000`, or use `run_in_background` and wait for it to finish; never treat a cut-off as a failed check.

| Script | Usage |
|---|---|
| `init.mjs` | `<repo> --run <name> --mode <invent\|modernize>`: checks the tree is clean, creates branch `evolve/<name>`, writes `evolve.json` with detected stack and a run marker, commits `evolve: start run <name>`, prints the marker as its last line |
| `check.mjs` | `<repo> --baseline`: round 0, records known issues, commits `evolve: baseline`. `<repo> --start N`: records start commit and time (refuses a dirty tree). `<repo> --round N`: setup (once), build, test, start, smoke, metrics, guardrails; exit 0 = pass, exit 1 = a hard guardrail failed. `<repo> --record-characterisation`: modernize |
| `scan.mjs` | `<repo> --round N`: walks the routes (desktop and 390 px), lists endpoints, writes `rounds/rNNN/scan.json` |
| `ship.mjs` | `<repo> --round N --summary <file>`: ships or reverts the round (see Ship) |
| `usage.mjs` | `<repo>`: finds the transcripts, writes `usage.json`, prints a one-line total |
| `dashboard/server.mjs` | `<repo> [--port N]`: the dashboard |

### Dependencies

Playwright (and optionally Lighthouse) live in `~/.cache/evolve/<plugin version>/`. `check.mjs --baseline` installs them on its first run
(`npm install` and `npx playwright install chromium`, it takes a while; tell the user). Scripts that need them fail with
`evolve: run /evolve start to install ...` if they were never installed: run `check.mjs --baseline` again.

### Config (`evolve.json`) defaults

| Key | Default | Meaning |
|---|---|---|
| `roundsPerBlock` / `blocks` | 5 / 3 | block size and count |
| `maxAttempts` | 3 | build-and-check attempts per round before a revert |
| `commandTimeoutMs` | 1200000 | timeout of the build and test commands (a timeout counts as failure) |
| `app.readyTimeoutMs` | 60000 | wait for the app to answer |
| `app.{kind,setup,build,test,start,url}` | detected | `start` may use `{port}` or the `PORT` variable, or `static:<dir>`; `url` may use `{port}` |
| `routes` | `["/"]` | routes walked by scan and checks |
| `endpoints` | `[]` | `{path, status}`, checked for backends and recorded in modernize |
| `thresholds` | `lighthousePerf -5`, `lighthouseA11y -5`, `cls 0.05` | allowed change against round 0 |
| `characterisation.ignore` | `[]` | JSON keys ignored when comparing recorded responses (ids, timestamps) |
| `knownIssues` | filled by `--baseline` | console errors, horizontal scroll routes, failing test count of round 0 |
| `prices` | built-in table | USD per million tokens per model; editable |

## Start

1. Check the tree. If the directory is not a git repo, or the tree is dirty, stop and ask the user.
2. Interview with `references/compass-interview.md`. Detect first, ask only for the rest. Settle: target, mode, rounds per block, blocks, compass, and for modernize the target stack.
3. `init.mjs <repo> --run <name> --mode <mode>`. Run name: short, letters, digits, `.`, `_`, `-`.
4. **Show the run marker** (the last line printed by init, `evolve-run:<name>:<hex>`) in your reply as plain text. Usage is found through it. Tell the user: do not paste the marker into other sessions. A transcript that merely quotes the marker is counted too, and unrelated usage would be added.
5. Edit `.evolve/evolve.json` with the interview results (commands, `routes`, `endpoints`, `roundsPerBlock`, `blocks`, thresholds). Write `.evolve/COMPASS.md`. Do not commit yet.
6. `check.mjs <repo> --baseline`. It first installs dependencies if needed (slow on the first run), then builds, tests, starts the app, walks the routes, takes screenshots and metrics, records the known issues, and commits `evolve: baseline` (including `evolve.json` and `COMPASS.md`).
   - If it reports `evolve needs a running baseline` (build or start failed), **stop**. Show the output, say that evolve needs a baseline that builds and starts, and ask the user to fix it. Run `--baseline` again afterwards.
   - If it reports `baseline left files: …`, show those files to the user and ask whether to ignore (`.gitignore`) or commit them, then rerun `--baseline`.
7. Show the **known issues** from `evolve.json` (`knownIssues`): console errors, routes with horizontal scroll, failing tests. A round may not add new ones and may fix old ones.
8. Modernize only: run the setup block (see "Setup block (modernize)") now, as the end of Start, and stop there for the user's confirmation.
9. Offer `/evolve board` and `/evolve next`.

## Next (invent mode)

Setup: read `.evolve/evolve.json`, `.evolve/COMPASS.md`. Check the tree is clean (else stop and ask). Find the block: the highest round number with a `summary.json`, counted in
rounds of `roundsPerBlock`. If all `blocks` are done, say so and suggest `/evolve review`. Block `B` covers rounds `(B-1)*roundsPerBlock+1` to `B*roundsPerBlock`.
Show the run marker from `evolve.json` again in your reply (same warning as in Start). Start the dashboard if it is not running (see Board).

**Scan.** Scanning may use a cheaper model. Run `scan.mjs <repo> --round F` with `F` the first round of the block. The script commits its own files as `evolve: scan rNNN`, so the tree stays clean. Read `scan.json` and add what the code shows: README, CLAUDE.md, git history, which backend data the UI does not use.

**Rounds.** For each round `N` of the block, in order, start **one subagent** (fresh context). Give it: the compass (`COMPASS.md`), the tail of `CHANGELOG.md` (last ~10 entries),
the latest `scan.json` (highest-numbered `rounds/r*/scan.json`), the round number `N`, the block number, whether the round is the **tidy-up round** (the last of the block),
the repo path and `${CLAUDE_PLUGIN_ROOT}`, and the instruction to follow "One round" below and `references/idea-rules.md` and `references/round-summary-schema.md`.
Rounds run one after another, never in parallel.

After each round subagent returns, the main session reads `.evolve/rounds/rNNN/summary.json`:
- missing, or ship failed, or the tree is not clean: **stop the block**, show what happened, ask the user.
- `status: reverted`: the revert was clean, but **stop the block** and show the `revertReason`. A failed round means the idea or the compass needs a look.
- `status: shipped`: note title and guardrail result, continue.

**After the block.**
1. `usage.mjs <repo>`. The script commits `usage.json` and `evolve.json` itself as `evolve: usage`.
2. Write the block summary: what shipped (titles), the best ideas, the metric trend against round 0 (Lighthouse, CLS, `mainContentTop`, `controlsAbove` from each `metrics.json` and `guardrails.json`), reverted rounds with reasons, tokens per model and the cost. Cost is always shown as "≈ … (estimate)", never as a fact; prices are editable in `evolve.json`. Models without a price are listed as unpriced.
3. Offer exactly three choices: **continue** (next block), **change the compass** (edit `COMPASS.md` with the user, commit it, then continue), **stop**.

## One round

The round subagent works in the repo on branch `evolve/<run>`.

1. **Start.** `check.mjs <repo> --start N`. If it refuses (dirty tree), stop and report.
2. **Read** the compass, the changelog tail and the latest scan.
3. **Idea.** Invent mode: follow `references/idea-rules.md`. Choose one idea not done yet. Write title, why, and the compass check (quote the rules). Tidy-up round: no feature, see below. Modernize: the next roadmap step, see below.
4. **Build.** Change the code. Keep the app runnable. Never invent data.
5. **Check.** `check.mjs <repo> --round N`. Exit 0 means all hard guardrails passed. It writes `rounds/rNNN/metrics.json`, `guardrails.json` and `shots/`. Read the `FAIL` lines.
6. **Fix.** On failure, fix the cause and run the check again. At most `maxAttempts` attempts in total (default 3, the first build counts as attempt 1). Count them for the summary field `attempts`.
7. **Ship.** Write the summary file to `<repo>/.evolve/local/summary-rNNN.json` (absolute path; fields in `references/round-summary-schema.md`), then
   `ship.mjs <repo> --round N --summary <repo>/.evolve/local/summary-rNNN.json`.
   - Guardrails passed: `status: "shipped"`.
   - Still failing after `maxAttempts`: `status: "reverted"` with a `revertReason` naming the failed guardrail. Do not try to ship a failing round.
8. **Report** one line to the main session: shipped or reverted, round number, title. Do not repeat the summary.

### Ship

For a shipped round `ship.mjs` reads `guardrails.json` (must pass), computes the changed files, diffs the screenshots against the previous shipped round, writes `summary.json`, appends `CHANGELOG.md`,
commits `evolve rNNN: <title>` and tags `evolve-<run>-rNNN`. If anything fails, ship undoes its own writes and exits 1; then report the error instead of retrying blindly.

### Revert

For `status: "reverted"` ship itself resets the branch to the round's start commit, removes untracked files except `.evolve/`, writes the summary from `guardrails.json` and commits
`evolve rNNN: reverted – <title>`. The round agent does not run `git reset`.

### Tidy-up round (last round of each block)

No new feature. Reduce clutter and quality debt measured since the block started: soft guardrails that got worse (`main-content-top`, `controls-above`, `page-bytes`), duplicated or unneeded UI, dead code, build warnings.
Set `tidy: true`. Hard guardrails apply as always. The rule "no polish-only rounds" does not apply here.

## Modernize mode

Rounds are roadmap steps, not ideas; see `references/modernize-playbook.md`.

**Setup block (modernize)** (the end of `/evolve start`, outside the chosen rounds, no round number is spent):
1. `scan.mjs <repo> --round 1` (it commits its own files).
2. `check.mjs <repo> --record-characterisation`. **Without a recording modernize mode is a hard fail**: every `check.mjs --round` reports the hard guardrail `characterisation` as failed. Add the key flows to `routes` and the endpoints to `endpoints` first; put volatile JSON keys (ids, timestamps) into `characterisation.ignore`.
3. Write `.evolve/ROADMAP.md` with the target stack from the interview, one small step per round.
4. Commit what you wrote and the recording (`git add .evolve && git commit -m "evolve: characterisation and roadmap"`) and **stop**. The user confirms or edits the roadmap. Only then does `/evolve next` run the chosen blocks.

**Blocks** (`/evolve next`). Same orchestration as invent mode: a scan per block (`scan.mjs` at the block's first round), one subagent per round, `summary.json` check, stop on failure, block summary. Differences:
- Round N is roadmap step N. No idea, no `idea-rules.md`; `compass` in the summary may be `[]`, `compassCheck` may be `""`.
- All hard guardrails apply, including `characterisation`. A failing characterisation means behaviour changed; fix the step, never re-record to make it green unless the user asks.
- The tidy-up round is code-level only (dead code, duplication, build warnings) and must not change behaviour.
- When the roadmap is finished before the block is, stop and say so.

## Board

Start or reopen the dashboard (localhost only):
1. If `.evolve/local/dashboard.log` has a line, take its last URL and test it (`curl -s <url>api/run`). If it answers, reuse it.
2. Otherwise start it **in the background** (Bash with `run_in_background`):
   `node "${CLAUDE_PLUGIN_ROOT}/dashboard/server.mjs" <repo> [--port N]`. The default port is 4173; if it is taken, the server takes the next free one. It prints `evolve dashboard: <url>` and appends that line to `.evolve/local/dashboard.log`.
3. Give the user the URL. Round applications are started on demand from git worktrees under `.evolve/worktrees/`; if a round cannot start, the dashboard shows its screenshots and the reason (see `.evolve/local/logs/app-rNNN.log`).

## Status

Short text, no changes: run name, mode, branch; block and last finished round; for the last round title, status and `guardrails.json` result (failed hard checks by name);
known issues count; open question (e.g. a stopped block). Usage: this runs `usage.mjs <repo>`, which may commit `evolve: usage` (its own files only),
and show tokens and "≈ … (estimate)". Say if `usage.json` is older than the last round.

## Review

After the last block, or when the user asks. Read the CHANGELOG, every `summary.json` and the compass. Write `.evolve/TRIAGE.md`: one entry per shipped round with **keep**, **adapt** or **drop**,
and a reason that cites the compass or a measured result (reverted rounds are listed as dropped, with the revert reason). Keep it a hand-off for porting to the real product: group the keeps, mark what needs adapting and how.
Commit it (`git add .evolve && git commit -m "evolve: triage"`). Do not push or open a PR; tell the user the branch name.

## Model use

Scanning (`scan.mjs`, reading `scan.json`) and measuring (`check.mjs`, `usage.mjs`) may be delegated to a cheaper model. Choosing the idea, the compass check and the build stay with the main model. Record the building model in the summary field `model`.

## References

- `references/compass-interview.md`: the start interview and `COMPASS.md` shape
- `references/idea-rules.md`: how to choose and check an idea, tidy-up round
- `references/modernize-playbook.md`: setup block, roadmap, characterisation
- `references/round-summary-schema.md`: the summary fields `ship.mjs` validates
