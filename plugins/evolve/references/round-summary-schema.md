# Round summary schema

`ship.mjs` validates the summary with `validateSummary` (`scripts/lib/summary.mjs`) before it writes
`.evolve/rounds/rNNN/summary.json`. The round agent writes a summary file (suggested path
`.evolve/local/summary-rNNN.json`, which is gitignored) and passes it with `--summary`. Ship fills in some fields itself.

## Fields

| Field | Type | Who sets it | Rule |
|---|---|---|---|
| `round` | integer >= 0 | ship (overwrites) | the `--round` number |
| `block` | integer >= 0 | round agent | block number the round belongs to |
| `mode` | `"invent"` or `"modernize"` | round agent | same as `evolve.json` |
| `status` | `"shipped"` or `"reverted"` | round agent | |
| `tidy` | boolean | round agent | `true` for the last round of a block |
| `title` | non-empty string | round agent | short name of the idea or step |
| `why` | non-empty string | round agent | why this idea, what the user notices |
| `compass` | array of strings | round agent | the compass rules the idea serves (may be empty) |
| `compassCheck` | string | round agent | the agent's own check against the compass, quoted (may be empty, but write it) |
| `startedAt` | ISO date string | ship (defaults from `start.txt`) | |
| `endedAt` | ISO date string | ship (defaults to now) | |
| `attempts` | integer >= 1 | round agent | build and check attempts used |
| `files` | array of `{path, added, removed}` | ship (computed; `[]` when reverted) | code changes against the start commit, `.evolve/` excluded |
| `guardrails` | `{pass: boolean, hard: [], soft: []}` | ship (from `guardrails.json`) | a shipped round needs `pass: true` |
| `model` | non-empty string | round agent | model that built the round |
| `revertReason` | non-empty string | round agent | required when `status` is `reverted` |
| `tag` | non-empty string | ship (only when shipped) | `evolve-<run>-rNNN` |

Ship deletes any `guardrails` and `tag` the agent supplies and recomputes them. All other fields,
including `files`, must be valid after ship has filled its own: a missing or mistyped field makes ship fail
with `summary invalid:` and a list of problems, and nothing is written.

## Minimal input (shipped)

```json
{
  "block": 1,
  "mode": "invent",
  "status": "shipped",
  "tidy": false,
  "title": "Next match on the start page",
  "why": "The start page now answers the first question a visitor has, using fixture data the backend already served.",
  "compass": ["data first", "newest first"],
  "compassCheck": "Compass 'data first': the card shows the match, no copy above it. OK.",
  "attempts": 1,
  "model": "claude-opus-5-5"
}
```

## Minimal input (reverted)

Same fields with `"status": "reverted"`, `"attempts": <n>` and a `revertReason`, for example
`"revertReason": "horizontal scroll at 390 px on /table after 3 attempts"`. Ship then resets the branch
to the round's start commit itself (see the skill, "Revert").

## Where the rest lives

- `.evolve/rounds/rNNN/start.txt`: start commit and time, written by `check.mjs --start`
- `.evolve/rounds/rNNN/metrics.json`, `guardrails.json`, `shots/`: written by `check.mjs --round`
- `.evolve/rounds/rNNN/summary.json`, `diffs.json`, `diff/`: written by ship
- `.evolve/CHANGELOG.md`: one entry per round, appended by ship
