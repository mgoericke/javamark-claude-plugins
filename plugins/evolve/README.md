# evolve

Iteration lab for Claude Code. evolve develops an existing git repository further **in rounds** on a local branch `evolve/<run>`.
Each round ships one idea, the app stays runnable, and every round is one commit plus the tag `evolve-<run>-rNNN`.
Rounds are grouped into blocks; evolve stops after each block so you can look, steer or stop.

- **invent mode**: every round is one bold new idea, chosen against a compass you write in the start interview.
- **modernize mode**: every round is one roadmap step toward a target stack; recorded behaviour must not change.

Each round is measured against round 0 (build, tests, app start, smoke, screenshots, Lighthouse, layout metrics, test count, build warnings) and only ships when the hard guardrails pass.
A local dashboard shows every round with its screenshots, diffs, guardrails and an estimated token cost (USD list prices, editable in `evolve.json`).

evolve never pushes, merges or deletes branches. Publishing is your call.

## Install

```bash
/plugin install evolve@javamark-claude-plugins
```

## Commands

| Command | What it does |
|---|---|
| `/evolve start` | Interview, create the run branch, install dependencies, take the baseline (round 0) |
| `/evolve next` | Scan, then run the next block of rounds, one subagent per round, then a block summary |
| `/evolve board` | Start or reopen the dashboard (localhost only) |
| `/evolve status` | Short text status: block, round, guardrails, known issues, usage |
| `/evolve review` | keep / adapt / drop for every round, written to `.evolve/TRIAGE.md` |

## Requirements

- Node >= 20
- git
- macOS or Linux

The first `check.mjs --baseline` installs Playwright, Chromium and the other dependencies into `~/.cache/evolve/<version>/`. That takes a while once.
Each round needs a clean git tree: `init.mjs` and `check.mjs --start` refuse a dirty one.
Token cost is only an estimate, based on a price table in `evolve.json` that you can edit. Only sessions in which an evolve script ran count toward it.

`/evolve start` detects npm projects, static sites and Maven or Gradle projects with Quarkus or Spring Boot, and asks you to confirm the commands.

## The `.evolve/` layout

Everything lives in the target repo under `.evolve/`.

```
.evolve/
├── evolve.json          # config and run marker
├── COMPASS.md           # what the product is and is not
├── ROADMAP.md           # modernize: one small step per round
├── CHANGELOG.md         # one entry per round
├── TRIAGE.md            # /evolve review result
├── usage.json           # token usage per round
├── characterisation/    # modernize: recorded behaviour
├── rounds/rNNN/         # start.txt, scan.json, metrics.json, guardrails.json,
│                        # shots/, summary.json, diffs.json, diff/
├── local/               # never committed
│   ├── dashboard.log
│   ├── logs/build-rNNN.log  # setup, build and test output of each check
│   ├── logs/start-rNNN.log  # app output during the check
│   ├── logs/app-rNNN.log    # apps started by the dashboard
│   ├── logs/scan-rNNN.log   # scan output
│   └── summary-rNNN.json    # round summary drafts
└── worktrees/           # never committed (gitignored), one git worktree per round
```

`.evolve/local/` and `.evolve/worktrees/` are gitignored by `init.mjs` and do not count as a dirty tree.

## Dashboard previews of old rounds

The dashboard starts an old round in its own git worktree under `.evolve/worktrees/`. It runs the `setup` command there, but not the build.
An app that serves a built `dist/` may therefore show a stale or empty page. Worktrees are never committed; you can delete `.evolve/worktrees/` at any time to free space.

## Development

```bash
node --test "plugins/evolve/scripts/test/*.test.mjs" "plugins/evolve/dashboard/test/*.test.mjs"
```

## More

- [Flow diagram](docs/flow.html): how a run, a block and a round fit together
- [Dashboard mock](docs/dashboard-mock.html): what the dashboard shows
- [skills/evolve/SKILL.md](skills/evolve/SKILL.md): the full protocol
