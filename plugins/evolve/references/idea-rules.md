# Idea rules (invent mode)

Read this before choosing an idea. It exists because of the Rasen-Radar lab: product rules arrived late and
rounds drifted, features piled up, and decluttering cost days. The rules below are the fix.

## The idea

1. **One bold idea per round.** Bold means a user notices it at once or behaves differently because of it.
   If you have to explain why it matters, it is not bold enough.
2. **Prefer unused backend data.** Read the latest `scan.json` (routes, endpoints) and the code. Data the
   backend serves but the UI does not use is the first place to look. A new endpoint is allowed when the UI needs it.
3. **Not done yet.** Check the CHANGELOG tail. Do not redo, rename or restyle an earlier idea.
4. **Real data only.** Never invent data, testimonials, reviews or user numbers. If an idea needs data that does not exist, pick another idea.

## The compass check

Before building, test the idea against every rule in `.evolve/COMPASS.md`, including the no-gos and the
audience. Write the check down and quote the rules by name, as in
`Compass "no prediction game": the card shows a past result, not a forecast. OK.`
This goes into `compass` (rule names) and `compassCheck` (the quoted check) in the round summary.
If any rule is violated, drop the idea and choose another. Do not bend the rule.

## What a round is not

- **No polish-only rounds.** Spacing, colours, renames and refactors are not an idea. The only exception is
  the planned tidy-up round, the last round of each block.
- **No clutter.** A new element has to earn its place. Count what is above the main content on a 390 px screen;
  if the idea adds a control there, remove or merge another one in the same round. The soft guardrails
  `main-content-top` and `controls-above` show this.
- **No piling up.** Two similar features are one feature too many. Extend or replace the existing one.

## The tidy-up round

The last round of every block adds no feature. It removes clutter and quality debt measured since the block
started: soft guardrails that got worse, duplicated UI, dead code, build warnings. Title it as such, set `tidy: true`.
In modernize mode it is code-level only and must not change behaviour.

## Quick self-check

- Would a user notice this in five seconds?
- Which unused data does it use?
- Which compass rules does it serve, and which could it hurt?
- What can be removed so the screen is not busier than before?
