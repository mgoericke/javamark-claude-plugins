---
description: Develop a repository further in rounds, one bold idea per round, with guardrails and a dashboard
argument-hint: start | next | board | status | review
---

# /evolve

Run the evolve protocol for: $ARGUMENTS

Load the `evolve` skill and follow the section that matches the first word of the arguments:

| Argument | Skill section |
|---|---|
| `start` | Start |
| `next` | Next (invent mode); for modernize mode also "Modernize mode" |
| `board` | Board |
| `status` | Status |
| `review` | Review |

Empty or unknown arguments: do not start anything. Print this help and stop.

```
/evolve start    interview, create the run branch, take the baseline
/evolve next     run the next block of rounds
/evolve board    start or reopen the dashboard
/evolve status   short text status: block, round, guardrails, usage
/evolve review   keep / adapt / drop for every round, written to .evolve/TRIAGE.md
```

evolve works on a local branch `evolve/<run>`. It never pushes, merges or deletes branches.
