# Round agent brief

Everything a round subagent needs in one place. The main session passes this file, the repo path, `${CLAUDE_PLUGIN_ROOT}`,
the round number `N`, the block number and whether the round is the tidy-up round. Read it whole before the first command.

## Rules

- Work only on the run branch in `<repo>` (absolute path in every call). Never push, merge, delete branches or `git reset` by hand.
- Do not edit `.evolve/rounds/*`, the scripts or the dashboard. You write code, `.evolve/local/summary-rNNN.json` and, if needed, `routes` in `.evolve/evolve.json`.
- Never invent data, testimonials, reviews or user numbers.
- Follow the project's own rules (`CLAUDE.md`, `AGENTS.md`, styleguide, architecture tests) like any change to that repo.
- Do not start subagents. Run one round, then report.

## Steps

1. `node <plugin>/scripts/check.mjs <repo> --start N`. It prints `round N started at …` and the run marker. `.evolve/rounds/rNNN/` stays untracked until ship; that is expected.
2. Read `.evolve/COMPASS.md`, the last ~10 entries of `.evolve/CHANGELOG.md`, the latest `.evolve/rounds/r*/scan.json` and the previous round's mobile screenshots (`rounds/rNNN/shots/*-mobile.png`).
3. Choose the idea (`idea-rules.md`; tidy-up and modernize rounds see below). Write title, why and the compass check.
4. Build it. Keep the app runnable.
5. If the round changes a page that is not in `routes`, add its route to `routes` in `.evolve/evolve.json` before the check. That route has no round-0 value, so its relative checks start with this round.
6. `node <plugin>/scripts/check.mjs <repo> --round N`. It takes minutes (build, all tests, start, browser walk, Lighthouse): use Bash `timeout: 600000` or run it in the background and wait. A cut-off is not a failure. Exit 0 means every hard guardrail passed; read the `FAIL` lines otherwise. Build and test output is in `.evolve/local/logs/build-rNNN.log`.
7. Fix and check again, at most `maxAttempts` attempts in total (the first check counts).
8. Write `<repo>/.evolve/local/summary-rNNN.json` (`round-summary-schema.md`) and run `node <plugin>/scripts/ship.mjs <repo> --round N --summary <that file>`.
   - All hard guardrails passed: `"status": "shipped"`.
   - Still failing after `maxAttempts`: `"status": "reverted"` with a `revertReason`. Ship resets the branch itself.
   - If ship fails, report its error; do not retry blindly.
9. Report one line: `shipped rNNN: <title>` or `reverted rNNN: <title> — <reason>`.

## Finding the idea

- `scan.json` lists routes and, when the app has an OpenAPI file or answers on common API paths, endpoints. A server-rendered app
  (Qute, Thymeleaf, JSP, Rails, Django) usually shows **0 endpoints**: then the data lives in the page models. Read the controllers or
  resources and the templates (`src/main/resources/templates/`, `templates/`, `views/`) and look for data a page model carries or a service
  computes that no template shows, or shows only on a deep page.
- Check the changelog and the git history so you do not redo an earlier idea.

## Measurements

| Check | Kind | Meaning |
|---|---|---|
| setup, build, start, smoke, endpoints | hard | as named; smoke = every route loads, no new console error, no new horizontal scroll or redirect |
| test | hard | failing tests may not exceed round 0 |
| lighthouse-perf, lighthouse-a11y, cls | hard | on the first route, against round 0 and the thresholds |
| characterisation | hard | modernize only |
| test-count | soft | total tests; fewer than round 0 means tests were removed |
| build-warnings | soft | warnings in the build output against round 0 |
| main-content-top, controls-above | soft | mobile only (390 px): pixels before the main content, controls above it; desktop views report `null` |
| page-bytes | soft | sum over all route views; `detail` names the view with the largest change |

## Tidy-up round

No feature, `"tidy": true`. Compare the last round's `metrics.json` and `guardrails.json` with the round before the block
(`rounds/r<first round of block - 1>`), read the block's changelog entries and diffs, and the build log for warnings. Remove what the block
left behind: soft guardrails that got worse, duplicated UI, dead code, unused CSS or scripts, stale docs. In modernize mode code-level only.

## Modernize round

Round N is roadmap step N in `.evolve/ROADMAP.md`. No idea rules; `compass` may be `[]`. The characterisation check is hard; never
re-record it to make it pass.

## Summary language

Write `title`, `why` and `compassCheck` in the user's language, the one the start interview was held in (the dashboard shows them as they are).
