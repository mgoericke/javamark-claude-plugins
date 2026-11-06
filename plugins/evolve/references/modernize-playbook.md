# Modernize playbook

Modernize mode changes how an application is built, not what it does. Behaviour must not change unless the user asked for it.

## Setup block (does not count against the chosen rounds)

1. Scan: `scan.mjs <repo> --round 1`, then commit the result.
2. Record characterisation: `check.mjs <repo> --record-characterisation`. It stores, under `.evolve/characterisation/`,
   the status and a body hash of every configured endpoint (GET) and the main text of every configured route.
   Without a recording, modernize mode is a hard fail on every round (hard guardrail `characterisation`).
   - The recording is only as good as `routes` and `endpoints` in `evolve.json`. Add the important flows and endpoints first.
   - Responses with ids, timestamps or tokens would never match twice: list those JSON keys in `characterisation.ignore`. Non-JSON bodies are hashed as-is.
   - Run the recording twice if unsure (commit, record again, `git diff`): an unstable recording means the keys to ignore are missing.
3. Write `.evolve/ROADMAP.md`: ordered small steps from the current stack to the target stack. Each step is one round, builds and passes alone, and names what it changes.
4. Commit, then **stop**. The user confirms or edits the roadmap before any round runs.

## Roadmap rules

- Smallest step that keeps the app running. Never "rewrite everything" in one round.
- Order by risk: build tooling and dependencies, then structure, then framework, then runtime and deployment.
- Each step states the check that proves it worked.
- Do not mix in improvements. A bug or a nicer UI noticed on the way goes into a "not now" list at the end of the roadmap.

## Rounds

Round N is roadmap step N. The idea rules do not apply: no new feature, no compass check for ideas, `compass` may be empty.
Every hard guardrail must pass, including `characterisation`. If it fails, the behaviour changed: fix the step, do not touch the recording.
Change the recording only when the user explicitly says a behaviour change is wanted.

## Tidy-up round

Last round of each block, code-level only: dead code, duplication, build warnings. No behaviour change, `characterisation` stays green.
