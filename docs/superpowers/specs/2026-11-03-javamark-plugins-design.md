# Design: `javamark-plugins` — one consolidated Claude Code plugin marketplace

| | |
| --- | --- |
| Status | **Draft — waiting for Mark's approval. Nothing gets built until then.** |
| Author of decisions | Mark Göricke (GitHub `mgoericke`, "javamark") |
| Written by | Claude, from Mark's brainstorming session (2026-11-02) |
| Sources read | `mgoericke/javamark-claude-plugins` @ `main`, `mgoericke/claude-mods` @ `6aea352`, the Claude Code publish docs and the directory pre-submission checklist (fetched 2026-11-02) |
| Final home | `~/Projekte/javamark-plugins/docs/superpowers/specs/` — the copy there is the source of truth; this branch only carries the doc. File date = planned approval date |

**How to read the markers.** Everything without a marker is **Mark's decision**. Two other kinds of statement are marked:

- **[Proposed]**: suggested by the assistant in the brainstorming session. Mark did not object, but it is **not yet confirmed**.
- **[Claude's call]**: a small point the assistant settled while writing this doc, so the builder isn't blocked. Mark can overrule any of them with one line.

This version already includes the answers to a "builder check": a fresh agent read only this doc and listed what it would need to plan the build. Points the doc could answer were folded in (mostly §6, §6a, §7); points only Mark can answer are in §0.

---

## 0. Open questions for Mark (most important first)

These are the questions only you can answer. Each one blocks or changes a part of the build; the section it affects is named.

1. **Do the domino, rabbit-map and schema-tree examples and test fixtures come from a work project?** The schema-tree examples are German residence-permit schemas (`aufenthalt/`, `azr-datensatz`, `ki-check-anfrage`), and the domino and rabbit-map tests, fixtures and READMEs use the same domain (`KiCheckResponseReceiver`, `VorgangService`, `KiCheckRabbitConfig`). You already decided to neutralize schema-tree. **Should domino and rabbit-map fixtures be neutralized the same way?** [Claude's call, pending your answer: yes; the plan in §5 assumes it.] Follow-up: is your employer (the ]init[ marketplace has a `usage` fork of cockpit) fine with these mods being published under MIT at all, given they were partly built around a work domain? → §5, §6.
2. **History: keep it or start clean?** Keeping the claude-mods git history ([Proposed], §6) publishes every old commit, **including the residence-permit schemas and the `KiCheck`/`Vorgang` fixtures**, even after the current files are neutralized. Options: (a) keep full history as-is; (b) keep history but strip those paths/strings with `git filter-repo` (rewrites commits, still shows the evolution); (c) import the current state as one commit per plugin and link the old repo… which is going to be deleted, so the history would be gone. [Claude's call, pending your answer: (b).] → §6.
3. **`cockpit` vs. its `usage` fork.** The ]init[ marketplace ships a fork named `usage`. Which code is the base for `token-lens`: the claude-mods `cockpit`, the `usage` fork, or a merge? If the fork, the builder needs read access to it (it is not in either source repo). And will your team switch from `usage` to `token-lens`, or keep `usage`? This decides whether "the team has switched" (the precondition for deleting claude-mods) includes cockpit at all. → §5.8, §6.
4. **Who does what?** §6a proposes a split between you and the builder (you: create the GitHub repo, review PRs, the rubberduck system prompt wording, portal submissions, team announcement and switch confirmation; builder: everything else). Confirm or adjust. → §6a.
5. **Confirm the four [Proposed] names**, knowing a new fact from the checklist (§3): a name that "matches a known brand" is *held for a human reviewer* (not blocked). `spring-…`, `jpa-…` and `java-…` all contain a third-party trademark (Spring/Broadcom, Jakarta EE/Eclipse, Java/Oracle), so the `java-` prefix is **not** obviously safer than `spring-`. All of these only matter at submission time; `jpa-entity-explorer` is the one in wave 1. Options for entity-picker: keep `entity-picker` (no brand, no hold, slightly less obvious), or `jpa-entity-explorer` (clear, likely a reviewer hold). [Claude's call, pending your answer: keep **`entity-picker`** for wave 1 and use `displayName: "Entity Picker for JPA"`; take the Spring names for wave 2 and accept the possible hold.] **All eight names, wave 2 included, must be final before the repo goes public** (§6 step 7), because the team installs them from then on. → §5.
6. **Version numbering in the new marketplace.** Start fresh, or carry the current numbers (`0.1.x` for the mods, `1.0.0` for the skills)? [Claude's call, pending your answer: every plugin is `0.9.0` while the repo is being built; the version-bump CI check (§7) switches on when the repo goes public; each plugin goes to `1.0.0` in the PR that prepares its directory submission.] → §4, §7.
7. **Which plan/account submits?** Submission needs a paid claude.ai plan; on Pro/Max/Ultra it's your personal account; on Team/Enterprise only an Owner (or someone with the *Directory* permission) can submit. Submit from your **personal** account so the listing shows "Mark Göricke" and not your employer? [Claude's call, pending your answer: personal account.] → §8.
8. **`author` identity and contact.** Every `plugin.json` and the marketplace `owner` need a name and, ideally, an email. The old repo has the placeholder `mark@example.de`. Which public email (or none, just `url: https://github.com/mgoericke`)? And should `author.name` be `Mark Göricke` (with `ö`, Latin script — allowed) or `Mark Goericke`? [Claude's call, pending your answer: `"Mark Göricke"`, `url` to GitHub, no email.] → §4.
9. **Is `claude-mods` actually public right now?** Its README says private, and an unauthenticated `git clone` failed during this session. If it is private, nothing changes in the plan, but the "keep history" question (2) becomes more sensitive, because that history has never been public before. The builder needs authenticated read access to it either way.
10. **CI auth.** `claude plugin validate` and `claude plugin test` run in GitHub Actions. If either needs a logged-in Claude account (to be checked by the builder, §7), are you OK with storing an API key as a repo secret, or should CI run only what works without auth?

---

## 1. Intent and why

Mark has two public-ish Claude Code plugin repositories that grew independently:

- `javamark-claude-plugins`: nine Markdown skill plugins (skills, commands, agents), English, marketplace name `javamark-claude-plugins`.
- `claude-mods`: seven TypeScript **mods** (function-hook plugins with panes, slash commands, status line), German, marketplace name `claude-mods`.

Neither is in a state to show people: two marketplaces with inconsistent names, mixed languages, missing licenses and metadata, plugins of uneven quality, and a README that tells people the repo is private.

The new repo **`javamark-plugins`** replaces both with **one public, English-only marketplace** that serves three audiences:

1. **Mark himself** — one place to install his own tools from.
2. **Mark's team at work** — one marketplace to add instead of two.
3. **The community** — plugins good enough to list in Anthropic's plugin directory, carrying the name "Mark Göricke / javamark".

The guiding principle is **fewer, but well-made plugins**. The repo, the directory listings and a later Substack post ("how to build Claude Code plugins and get them into Anthropic's directory") together make the author visible.

## 2. Goals, non-goals, anti-goals

### Goals (success in ~3 months)

- Public repo `mgoericke/javamark-plugins` with a showcase README; first GitHub stars.
- Wave 1 (four plugins) submitted to Anthropic's directory.
- The team installs from `javamark-plugins`; `claude-mods` deleted; `javamark-claude-plugins` archived with a pointer.
- A submission logbook in the repo with enough raw material for the Substack post.

### Non-goals

- Writing the Substack post (separate, later project).
- New plugins or new features. The only feature work is what the decisions require: neutral examples, cockpit refocus, translation.
- Getting into `anthropics/claude-plugins-official` (`external_plugins`). That needs an Anthropic partner contact; out of scope.
- Supporting claude.ai chat / Cowork for the mods. The directory lists mods for **Claude Code only**; that's accepted.

### Anti-goals (things this project must not do)

- Publish a plugin under a name that will need to change later. Names are permanent once published (`name@marketplace` is the install key).
- Ship anything in German that a user reads (READMEs, descriptions, UI labels, messages), or any example that reveals a work project or customer domain. Undocumented German *input* aliases (keywords and command aliases Mark's team already types) are allowed [Claude's call]; they are never shown in READMEs or UI.
- Keep the cost/euro/price-table features in the cockpit successor.
- Carry over the dropped plugins "just in case".
- Delete `claude-mods` before the team has switched.

## 3. Constraints: directory rules that shape the design

Verified against https://code.claude.com/docs/en/plugins/publish.md and https://claude.com/docs/plugins/pre-submission-checklist on 2026-11-02. "Blocks" = cannot submit; "Hold" = submit OK, a human reviewer reads it first.

| Rule | Result if broken | Consequence for us |
| --- | --- | --- |
| One plugin folder (with `.claude-plugin/plugin.json`) per submission | Blocks | Four separate submissions for wave 1 |
| Public GitHub repo to go live (private is OK to validate) | — | Repo goes public before submission |
| `LICENSE` in the plugin folder **or** `license` in `plugin.json` | Blocks | Both: `"license": "MIT"` **and** a `LICENSE` copy per plugin folder [Claude's call] |
| `README.md` in the plugin folder, ≥ 40 words outside code blocks | Blocks | Per-plugin English README |
| `name`: lowercase ASCII, digits, hyphens, ≤ 64 chars, starts/ends alphanumeric; not reserved (`claude`, `anthropic`, `official`, `plugin`, `mcp`, `test`), not taken, nothing implying "official" | Blocks | All names below comply; `claude-mods` would be blocked as a plugin name |
| Name/`displayName`/`author.name` resembling a known brand or existing listing | Hold | `spring-…`, `jpa-…`, `java-…` names may be held (open question 5) |
| Fork using the upstream's name | Hold | `cockpit` has a fork `usage`; the new name `token-lens` avoids the clash either way |
| Component keys spelled as in the manifest reference | Blocks | Remove the non-standard `components` field (javamark plugins) |
| `description`, `author`, `version` set | Warning | Set everywhere; `--strict` turns warnings into CI failures |
| No `.DS_Store`/`Thumbs.db`/`desktop.ini`/`__MACOSX`; no symlinks, submodules, LFS | Blocks | `.gitignore` + CI check |
| Non-image files < 256 KiB, ≤ 512 files, only text/SVG/PNG/JPEG/GIF/WebP/fonts | Hold | Current mods are far below; keep screenshots/GIFs at the repo root, not inside plugin folders [Claude's call] |
| Bundled images referenced only via Markdown image syntax in the README | Hold | Applies only if images go into plugin folders — we avoid that |
| Package launchers pinned to exact versions; no `.npmrc` etc. | Blocks | None of our plugins use launchers today |
| No secrets; credentials via `userConfig` with `sensitive: true` | Blocks | None needed today |
| README discloses everything the plugin runs, sends, fetches | Security scan rejects | Each README gets a "What it reads, writes and runs" section (the German READMEs already have one — translate it) |
| Readable source, no minified code | Hold | Mods are plain TS/TSX ✓ |
| **Non-shell file run by a hook when the plugin is a subfolder of the repo** | Hold ("Scripts the validator couldn't follow") | **Every mod in a marketplace repo will be held for a reviewer.** Accepted: it costs waiting time, not rejection. The alternative (one repo per mod) contradicts the one-marketplace decision |
| Never rename after publishing; `version` must increase on every release (or be omitted) | — | Names fixed before the repo goes public; version bump enforced in CI (§7) |

## 4. Target repo layout and `marketplace.json`

```
javamark-plugins/
├── .claude-plugin/
│   └── marketplace.json
├── .github/
│   └── workflows/ci.yml
├── LICENSE                         MIT, © 2026 Mark Göricke
├── README.md                       showcase: one section per plugin, screenshot/GIF, one-line install
├── CONTRIBUTING.md                 short: how to run validate/tests locally (optional, [Claude's call])
├── docs/
│   ├── superpowers/specs/          this design doc
│   ├── submission-logbook.md       §8
│   └── media/                      screenshots and GIFs for the root README (NOT inside plugin folders)
├── scripts/                        (English comments and messages; paths `mods/` → `plugins/`)
│   ├── validate.sh                 claude plugin validate --strict for every plugin
│   ├── test.sh                     claude plugin test for every plugin that has tests/
│   └── dev.sh                      claude with --plugin-dir for every plugin (from claude-mods)
└── plugins/
    ├── rubberduck/                 mod   — wave 1
    ├── schema-tree/                mod   — wave 1
    ├── entity-picker/              mod   — wave 1  (name: open question 5)
    ├── wiki-llm/                   skills — wave 1
    ├── token-budget/               skills — wave 2
    ├── spring-call-chain/          mod   — wave 2  (ex domino)
    ├── spring-amqp-map/            mod   — wave 2  (ex rabbit-map)
    └── token-lens/                 mod   — wave 2  (ex cockpit)
```

Layout decisions:

- **One folder `plugins/` for skills and mods alike** [Claude's call]. The distinction is visible in each plugin's README and in the root table, not in the path. Users never see paths.
- **Folder name = plugin `name`** [Claude's call]. Directory submissions are by folder, and the folder path can't change after submission, so the folder name is as permanent as the plugin name.
- The `_template/` folder from javamark-claude-plugins and `scripts/new-mod.sh` from claude-mods are **not** carried over [Claude's call] — fewer things to translate; the `plugin-authoring` skill covers scaffolding.
- `skills/.gitkeep` from claude-mods is dropped.

Each plugin folder:

```
plugins/<name>/
├── .claude-plugin/plugin.json
├── LICENSE                 copy of the root LICENSE
├── README.md               English, ≥ 40 words, sections: What it does · Usage · What it reads, writes and runs · Install · Development
├── hooks/                  (mods) hooks.json { "modules": ["./register.tsx"] } + sources
├── types/                  (mods) index.d.ts
├── tests/                  (mods) *.test.tsx
├── skills/ commands/ agents/ references/   (skill plugins)
└── examples/               (schema-tree, spring-amqp-map) neutral examples only
```

`plugin.json` template (every plugin):

```json
{
  "name": "<name>",
  "displayName": "<Human Name>",
  "version": "0.9.0",
  "description": "<one English sentence>",
  "author": { "name": "Mark Göricke", "url": "https://github.com/mgoericke" },
  "homepage": "https://github.com/mgoericke/javamark-plugins/tree/main/plugins/<name>",
  "repository": "https://github.com/mgoericke/javamark-plugins",
  "license": "MIT",
  "keywords": ["..."]
}
```

plus `types` and `userConfig` where the plugin has them. `types/index.d.ts` is committed source (the mod's `$.state` contract); the engine-generated API types under `plugins/<name>/.claude-plugin/types/` are gitignored, as in claude-mods today. `displayName` lets the short, friendly product names survive as labels even where the `name` is descriptive (e.g. `spring-call-chain` with `displayName: "Domino — Spring call chains"`) [Claude's call; `displayName` is documented in the publish guide].

`marketplace.json`:

```json
{
  "name": "javamark-plugins",
  "description": "Claude Code plugins by Mark Göricke (javamark): panes for Java/Spring projects, JSON Schema and token usage, a rubber-duck debugging mode and a Markdown wiki.",
  "owner": { "name": "Mark Göricke", "url": "https://github.com/mgoericke" },
  "plugins": [
    { "name": "rubberduck",        "source": "./plugins/rubberduck",        "description": "...", "category": "...", "tags": ["..."] },
    { "name": "schema-tree",       "source": "./plugins/schema-tree",       "description": "...", "category": "...", "tags": ["..."] },
    { "name": "entity-picker",     "source": "./plugins/entity-picker",     "description": "..." },
    { "name": "wiki-llm",          "source": "./plugins/wiki-llm",          "description": "..." },
    { "name": "token-budget",      "source": "./plugins/token-budget",      "description": "..." },
    { "name": "spring-call-chain", "source": "./plugins/spring-call-chain", "description": "..." },
    { "name": "spring-amqp-map",   "source": "./plugins/spring-amqp-map",   "description": "..." },
    { "name": "token-lens",        "source": "./plugins/token-lens",        "description": "..." }
  ]
}
```

- Every entry has `name`, `source`, `description`, `category` and `tags` (shortened above) [Claude's call].
- Entry `name` equals the `plugin.json` `name` (docs require it).
- `version` lives only in `plugin.json`, not duplicated in the marketplace entry [Claude's call: avoids the two drifting apart, which the old javamark marketplace invites].
- Install line, everywhere: `/plugin install <name> --marketplace mgoericke/javamark-plugins` (one step, Claude Code ≥ 2.1.275 — verified in the publish docs on 2026-11-02) and the two-step form `/plugin marketplace add mgoericke/javamark-plugins` + `/plugin install <name>@javamark-plugins`.
- No `renames` map: renames happen before anything is published under the new marketplace, and `renames` works within one marketplace, not across marketplaces. Team members re-install once (§6).

## 5. Per-plugin plan

Common to every plugin (not repeated below): English `plugin.json` description, `license`/`author`/`version`/`repository`/`homepage` set, `LICENSE` copy, English README with the five sections from §4, `claude plugin validate --strict` clean, tests green, README "Install" section points to `javamark-plugins`, no "the repo is private" sentence, root README entry with a screenshot or GIF.

"Translate" for a mod means **all** user-visible text: pane titles and labels, status line, toasts, dialog texts, command replies, `userConfig` titles/descriptions/keys, slash-command aliases, and the test assertions that check those strings. Code comments are already English in the files sampled; the builder checks the rest.

### 5.1 `rubberduck` — wave 1

- **Source:** `claude-mods/mods/rubberduck` (`register.tsx`, `duck.ts`, `scene.ts`, 1 test file, ~1.1k lines).
- **Name:** unchanged, `rubberduck`. `displayName: "Rubber Duck"`.
- **Changes:**
  - Translate everything (pane "Rubberduck", states "hört zu", "denkt mit", "Juhu!", stage names "Fragen/Hinweise/Lösungsansatz", footer).
  - The mode is triggered by keywords in the user's prompts. Today: `an/on/start`, `aus/off/stop/ende`, "Tipp/Lösung/hint/solution/sag's mir", "aha/gelöst/läuft/ich glaub ich hab's". **English keywords become primary; German ones stay as aliases** [Claude's call: Mark and his team type German; removing them costs nothing to keep and the README lists only the English ones].
  - The system-prompt section it injects is translated to English (it controls Claude's behaviour, so its wording is reviewed, not machine-translated).
  - README must disclose clearly: reads prompts and replies, adds a system-prompt section while the mode is on, no files, no processes, no network.

### 5.2 `schema-tree` — wave 1

- **Source:** `claude-mods/mods/schema-tree` (`register.tsx`, `schema.ts`, `find.ts`, 1 test file, `examples/`).
- **Name:** unchanged. `displayName: "Schema Tree"`.
- **Changes:**
  - **Replace all example schemas** (`examples/antrag.schema.json`, `examples/aufenthalt/**`, `examples/common/person.schema.json`) with a neutral set that exercises the same features: cross-file `$ref`, `allOf` merging, `oneOf`/`anyOf`, enums/`const`, a cycle, a broken ref, a remote ref. [Claude's call: a small "online shop" domain — `order.schema.json` → `common/address.schema.json`, `common/customer.schema.json`, `common/codes.schema.json`, `payment/payment.schema.json` with `oneOf` card/invoice/… — consistent with the existing `rabbit-map/examples/shop`.]
  - Update the tests that reference example file names or field names.
  - Subcommands `/schema auf` / `/schema zu` → `/schema expand` / `/schema collapse` (German kept as aliases, as in 5.1).
  - Translate pane texts ("zyklisch", legend "Pflicht/optional", error messages).

### 5.3 `entity-picker` (or `jpa-entity-explorer`) — wave 1

- **Source:** `claude-mods/mods/entity-picker` (8 hook files incl. `hibernate.ts`, `ddl.ts`, `er.ts`, `check.ts`; 1 test file, ~2.7k lines — the largest wave-1 mod).
- **Name:** see open question 5. The plan works with either; the folder follows the name.
- **Changes:**
  - Translate tabs (**Datenbank/DDL/Check** → **Table/DDL/Check**), buttons ("Als Migration speichern", "Aktualisieren", "Vollständig/Delta"), progress notes (`'javac übersetzt die Entities …'`), check findings, the "derived, not generated by Hibernate" banner, and the header comment written into saved migration files.
  - **Disclosure is the critical part for the security scan**: the mod runs `./mvnw`/`mvn` (dependency resolution, may download from Maven Central or the project's configured repos), `javac`, and a Java program in a `mktemp -d` folder; it writes migration files only after a confirmation dialog. The current German README already says this; the English one must keep all of it, explicitly naming the network access Maven may do.
  - Translate the long devcontainer/proxy troubleshooting paragraph; move it to a "Troubleshooting" section.

### 5.4 `wiki-llm` — wave 1

- **Source:** `javamark-claude-plugins/plugins/wiki-llm` (skills `wiki`, `wiki-curator`; commands `wiki`, `wiki-init`, `wiki-save`, `wiki-save-session`, `wiki-connect`, `wiki-status`; 3 references). Already English.
- **Name:** unchanged. `displayName: "Wiki LLM"`.
- **Changes:**
  - Remove the non-standard `components` field from `plugin.json` (blocks submission); skills/commands are discovered from the default folders.
  - `author: "Mark"` → full author block.
  - The plugin has **no README in its folder today** — the text lives in the root README of javamark-claude-plugins. Move it into `plugins/wiki-llm/README.md`, add "What it reads, writes and runs" (reads/writes Markdown under `$WIKI_ROOT` or `~/wiki`; check whether any command runs `git` — if so, disclose).
  - Description mentions "Inspired by Karpathy's Wiki-LLM concept": keep it in the README, **drop it from `description`/`displayName`** [Claude's call: a person's name in the listing metadata invites a "known brand / person" hold for no benefit].
  - Proof-read for leftover German.
  - Submitting it means it also loads on claude.ai chat and Cowork (skills and commands load there), but it needs a local Markdown folder. The README says plainly: "Built for Claude Code; on claude.ai the skills load but have no wiki folder to read." [Claude's call; no claude.ai testing required.]

### 5.5 `token-budget` — wave 2

- **Source:** `javamark-claude-plugins/plugins/token-budget` (skill, command, 3 references). English.
- **Name:** unchanged.
- **Changes:** remove `components`; full author block; create a plugin-folder README (none today); proof-read. Its "cost budget" reference is about *building* LLM apps (LangChain4j/Quarkus), so the "no cost features" decision for `token-lens` does **not** apply here [Claude's call].

### 5.6 `spring-call-chain` (ex `domino`) — wave 2

- **Source:** `claude-mods/mods/domino` (6 hook files, 5 test files + `fixture.ts`, ~3k lines).
- **Name:** `spring-call-chain` [Proposed]. `displayName: "Domino — Spring call chains"` [Claude's call, keeps the brand Mark already uses].
- **Changes:**
  - Commands `/domino` and `/kette` → `/call-chain`, with `/domino` and `/kette` kept as hidden aliases [Claude's call].
  - Neutralize fixtures and README example (`KiCheckResponseReceiver`, `VorgangService`, `/vorgaenge/{id}`, …) → shop domain (`OrderController`, `PaymentListener`, …) — pending open question 1.
  - Translate labels ("Aufrufkette", "Startpunkt", "Art", "Datenbank", "abgeschnitten", "siehe oben", legend, "Link-Stil" option). Default export path `docs/aufrufkette-<start>.md` → `docs/call-chain-<start>.md`.
  - `userConfig.linkStyle`: README mentions a `none` option that the manifest's `options` list lacks — fix while translating.
  - Keep the Unicode-width rule and its test (README "Development" section).

### 5.7 `spring-amqp-map` (ex `rabbit-map`) — wave 2

- **Source:** `claude-mods/mods/rabbit-map` (10 hook files incl. `asyncapi.ts`, 1 test file, `examples/shop`).
- **Name:** `spring-amqp-map` [Proposed]. `displayName: "Rabbit Map — Spring AMQP topology"` [Claude's call].
- **Changes:** `/rabbit` stays as the command [Claude's call: short and unambiguous]; translate graph/check/routing labels and the check texts; export file `rabbitmq-topologie.md` → `rabbitmq-topology.md`; neutralize `KiCheckRabbitConfig` in `source.ts` doc comment and in tests (open question 1). `examples/shop` is already neutral; translate its README and check the Java package `de.shop` [Claude's call: rename to `com.example.shop`].

### 5.8 `token-lens` (ex `cockpit`) — wave 2

- **Source:** `claude-mods/mods/cockpit` (`register.tsx` 440 lines, `meter.ts` 199 lines, 1 test file) — or the `usage` fork (open question 3).
- **Name:** `token-lens` [Proposed]. `displayName: "Token Lens"`.
- **Refocus (Mark's decision):** remove **all** cost/euro/price features; focus on tokens, cache hits, context usage, per-model and per-agent breakdown.
  - Remove: `userConfig.preise`, `parsePrices`, `costOf`, `totalCost`, `cost` in `types/index.d.ts`, the euro total in the header, per-model cost column and `local`/`free`/`?` labels, the yellow "models without a price → `/config cockpit`" hint, and the tests for those.
  - Keep: active time, state, context gauge (green < 60 %, yellow ≤ 80 %, red), tempo gauge (output tokens/s), cache gauge (read/write cache tokens, hit rate), per-model calls and tokens (with input/output split or share bar), per-agent status/runtime/tokens, collapsible sections, status line `<tempo> t/s · ctx <n> %`.
  - With `userConfig` gone, the plugin has no options; fine.
  - Command `/cockpit` → `/token-lens`, `/cockpit` kept as alias [Claude's call]. Pane title "Token Lens".
  - Still opens itself at session start (existing behaviour) — keep [Claude's call]; mention it in the README.

### Dropped (not migrated)

`review-toolkit`, `java-scaffold`, `frontend-toolkit`, `openapi-toolkit`, `infografik`, `hello`, `sdd-toolkit`, `doc-toolkit`. They stay readable in the archived `javamark-claude-plugins` repo; `hello` disappears with `claude-mods`.

## 6. Migration, archival and deletion sequence

Ordered; each step's precondition is the previous step.

1. **Mark approves this doc** and answers §0 (at least questions 1–5).
2. **Create the repo locally** (`~/Projekte/javamark-plugins`), private on GitHub at first. Add LICENSE, `.gitignore` (from javamark-claude-plugins, with the claude-mods ignore rule for engine-generated types moved to `plugins/*/.claude-plugin/types/`), empty marketplace, this doc.
3. **Import the mods with history** [Proposed] — per mod, on a throwaway full (non-shallow) clone of claude-mods, never on the only copy:
   `git filter-repo --path mods/<old>/ --path-rename mods/<old>/:plugins/<new>/` (plus `--invert-paths` for removed paths, `--replace-text` for file contents and `--replace-message` for commit messages, using the list from open question 2; the builder drafts that list with `git log -p | grep`, Mark confirms it), then `git merge --allow-unrelated-histories` into javamark-plugins. Alternative: `git subtree`. Verify with `git log --follow plugins/<new>/hooks/register.tsx` and `git log -p --all | grep -iE '<scrub list>'` (must return nothing). Rollback = delete the local javamark-plugins clone and start the import again; nothing is pushed until the check passes. Commit-message language does not matter (history isn't user-facing).
4. **Import the two skill plugins** (`wiki-llm`, `token-budget`) the same way from javamark-claude-plugins (`plugins/<name>/` keeps its path).
5. **Rename, translate, refocus, neutralize** per §5, one PR per plugin [Claude's call: reviewable chunks, and each PR is a logbook entry]. Steps 2–4 go straight onto `main` while the repo is private and unused; from step 5 on, every change is a PR that Mark reviews. Order: wave 1 first (schema-tree, rubberduck, wiki-llm, entity-picker), then wave 2; the plugin PRs are independent of each other and can run in parallel once CI (step 6) exists.
6. **CI green** (§7) on all eight plugins. CI is set up right after step 4 so that every step-5 PR runs it. All eight must be translated before step 7 because the repo is English-only, but wave-2 *quality-bar* items (screenshots, submission polish) can follow after going public.
7. **Make the repo public.** From here on, names are frozen.
8. **Announce to the team** (Mark): remove `claude-mods` (and, if they switch, `usage`) marketplaces, add `mgoericke/javamark-plugins`, re-install. One message with the exact commands; for the renamed mods, a mapping table old → new.
9. **Archive `javamark-claude-plugins`**: replace its README with a pointer (short English notice + link + "wiki-llm and token-budget moved; other plugins are discontinued"), commit, then archive in GitHub settings. Archiving keeps existing installs working read-only.
10. **Update claude-mods' README** with the same pointer (cheap insurance while the team switches).
11. **Delete `claude-mods`** only after the team confirms the switch [Proposed] — Mark asks the team and decides; default deadline two weeks after the announcement [Claude's call]. Deleting breaks every install from it. Before deleting: confirm step 3 history import is complete and keep a local `git bundle` backup [Claude's call].
12. **Wave 1 submission** (§8) can start right after step 7 and runs in parallel with 8–11.
13. **Wave 2 submission** starts after the first wave-1 plugin has been approved, so its lessons (logbook) apply [Claude's call]. Same quality bar, same process.

### Done per step

| Step | Done when |
| --- | --- |
| 2 | Repo exists (private), `claude plugin validate .` passes on the empty marketplace |
| 3–4 | All eight plugins under `plugins/`, `git log --follow` shows history, scrub grep is empty, marketplace lists all eight |
| 5 | Per plugin: §5 changes done, behaviour unchanged except the listed edits, smoke test (below) passed, PR approved by Mark |
| 6 | CI green on `main` |
| 7 | Repo public, README showcase in place for wave 1 |
| 9–11 | Pointers committed, old repo archived; claude-mods deleted after confirmation, `git bundle` backups of both old repos kept locally |

**Smoke test per mod** [Claude's call]: load with `scripts/dev.sh` (installed copies off), then: the pane opens via its command, shows English text, reacts to one relevant edit by Claude (where the mod does that), on the terminal and on desktop or VS Code. For `entity-picker`, against a small Maven project with a JDK installed. For skill plugins: run each command once in Claude Code.

## 6a. Who does what [Claude's call, open question 4]

| Mark | Builder |
| --- | --- |
| Answer §0; approve this doc | Everything in §4–§7 not listed left |
| Create `mgoericke/javamark-plugins` on GitHub and grant the builder push access; read access to claude-mods (and the `usage` fork, if needed) | Draft the history-scrub list for Mark to confirm |
| Review and merge each plugin PR; review the English rubberduck system-prompt text word by word | Translations, renames, refocus, neutral examples, tests, CI |
| Record screenshots/GIFs, or approve the builder's (needs a real Claude Code session) | Draft the team announcement and the old-repo pointer READMEs |
| Portal Validate/Submit (needs his claude.ai account); paste findings into the logbook | Fix findings; keep the logbook tidy |
| Team announcement; confirm the switch; archive and delete old repos | |

### Environment the builder needs

Git ≥ 2.30 and `git filter-repo`; the Claude Code CLI (same version locally and in CI); a JDK 17+ and Maven for the entity-picker smoke test; GitHub push access to the new repo. Whether the mod tests need Node or Bun beyond the Claude Code CLI is checked in the first build step and pinned in CI.

### Rough timeline [Claude's call]

Weeks 1–2: answers, repo, import, CI. Weeks 3–6: wave-1 PRs, then wave-2 PRs. Week 7: public, team switch, first submission. Weeks 8–12: remaining wave-1 submissions, reviews, old-repo cleanup, wave 2 when the first approval is in. Leaves margin inside the three-month goal.

## 7. Quality bar and CI

### Quality bar for wave 1 [Proposed]

- `claude plugin validate --strict plugins/<name>` clean (zero warnings). The local validator does not check directory rules, so the expected portal holds (§3) don't affect this.
- MIT `LICENSE` (root + per plugin) and `license`, `author`, `version`, `repository` in every `plugin.json`.
- Per-plugin README ≥ 40 words, disclosing what the plugin runs, reads, writes, sends.
- Existing tests green (`claude plugin test plugins/<name>`); updated tests for every translated string and every removed feature.
- Portal **Validate** has no *Blocking* finding (checked at submission time; logged).
- Root README showcase: one section per plugin with screenshot or GIF and a one-line install. For skill plugins the image is a terminal screenshot of one typical command (`/wiki <question>`, `/token-budget`) and its answer.
- No German left in user-visible text: CI grep for common German words and umlauts in `plugins/**` outside `examples/` [Claude's call: cheap, catches regressions]. Allow-list: `Göricke`, and the hidden German aliases (kept in one clearly named constant per mod so the grep can skip it).
- No files from the forbidden list (`.DS_Store`, …), no symlinks, no file > 256 KiB in a plugin folder.

Wave 2 plugins meet the same bar before their own submission; until then they must at least validate and pass tests.

### CI (GitHub Actions, on push and PR) [Proposed]

`.github/workflows/ci.yml`:

1. Checkout.
2. Install Claude Code CLI at a **pinned** version (the mod API is versioned with the CLI; pin to the version the tests were written against) [Claude's call]. The builder reads the version from `claude --version` on Mark's machine (where the mods were last tested) and pins that.
3. `scripts/validate.sh` → `claude plugin validate --strict` per plugin + `claude plugin validate .` for the marketplace.
4. `scripts/test.sh` → `claude plugin test plugins/<name>` for every plugin with `tests/`.
5. Hygiene checks: forbidden files, symlinks, file sizes, German-word grep, `name` in marketplace entry == `name` in `plugin.json` == folder name.
6. **Version bump check** on PRs, **enabled when the repo goes public** (§6 step 7): if anything under `plugins/<name>/` changed, its `version` must be higher than on `main`; a plugin new on the branch is exempt [Claude's call: the docs warn that unchanged versions mean users never receive the update].

To verify by the builder before writing CI: whether `claude plugin validate`/`test` work without authentication (open question 10). If the CLI needs auth, use a repo secret `ANTHROPIC_API_KEY` or drop the step to local-only and document it.

## 8. Submission process and logbook

### Process per wave-1 plugin

Order [Claude's call]: `schema-tree` first (smallest risk: no processes, no prompt injection, no network), then `rubberduck`, `wiki-llm`, `entity-picker` (most to disclose). Learn from the first before sending the others.

1. Plugin meets the quality bar; repo is public; `main` is the tracked branch.
2. https://claude.ai/directory/manage → **Submit new** → **Plugin bundle** → repo `mgoericke/javamark-plugins`, folder `plugins/<name>` (exact capitalization).
3. **Validate**. Fix every *Blocking* finding, push, **Re-validate** in the same form. Expected *Policy hold*: "Scripts the validator couldn't follow" for every mod (§3); possibly "Name matches a known brand".
4. Submit. Automated validation + security scan + human review for new listings.
5. After approval: updates ship by merging to `main` with a version bump; each new commit is scanned again.

Docs: https://code.claude.com/docs/en/plugins/publish.md, https://claude.com/docs/plugins/pre-submission-checklist, https://claude.com/docs/plugins/submit.

### Submission logbook [Proposed]

`docs/submission-logbook.md`, append-only, one entry per event. Raw material for the Substack post, so write it while it happens, not afterwards. Template [Claude's call]:

```markdown
## 2026-MM-DD — <plugin> — <event: local validate | portal validate | submitted | held | approved | rejected | update>
- What I did:
- What the tool/portal said (verbatim finding titles):
- What I changed (commit/PR link):
- Time spent / waited:
- Surprise or lesson (for the post):
```

Seed entries from the migration itself: the `components`-field and `model_preference` findings, the placeholder email, the "private" README, name decisions and the brand-hold reasoning from §0 question 5.

## 9. What is left to the builder

The builder plans and executes; these choices are deliberately left open:

- Exact wording of English READMEs, descriptions, `displayName`s, tags and categories (Mark reviews).
- The neutral example schemas and fixtures (within the constraints in §5.2 and §5.6/5.7).
- `git filter-repo` vs `git subtree` mechanics, as long as `git log --follow` works per plugin and open question 2 is respected.
- Screenshot/GIF tooling and the root README layout.
- CI implementation details (job split, caching), as long as §7 is covered.
- Translating code comments and identifiers: only where they leak into user-visible text or contain German. English code comments stay as they are.
- Found during the read but out of scope: old `model_preference` in `frontend-toolkit` agents and the inconsistent marketplace name in the old README (`javamark-claude-skills`) — irrelevant because those plugins are dropped and the old README is replaced; just log them.

## Appendix A — Inventory found in the sources

| Plugin | Repo / path | Kind | Lang | Version | Tests | Notable |
| --- | --- | --- | --- | --- | --- | --- |
| rubberduck | claude-mods `mods/rubberduck` | mod | DE | 0.1.0 | 1 | injects system-prompt section in mode |
| schema-tree | claude-mods `mods/schema-tree` | mod | DE | 0.1.0 | 1 | residence-permit example schemas |
| entity-picker | claude-mods `mods/entity-picker` | mod | DE | 0.1.1 | 1 | runs mvn/javac; writes migrations after confirm |
| cockpit | claude-mods `mods/cockpit` | mod | DE | 0.1.0 | 1 | `userConfig.preise`, euro costs; fork `usage` elsewhere |
| domino | claude-mods `mods/domino` | mod | DE | 0.1.1 | 5 | work-domain fixtures; `linkStyle` option mismatch |
| rabbit-map | claude-mods `mods/rabbit-map` | mod | DE | 0.1.2 | 1 | `examples/shop` already neutral |
| hello | claude-mods `mods/hello` | mod | DE | 0.1.0 | 0 | dropped |
| wiki-llm | javamark `plugins/wiki-llm` | skills | EN | 1.0.0 | 0 | `components` field; no plugin README |
| token-budget | javamark `plugins/token-budget` | skills | EN | 1.0.0 | 0 | `components` field; no plugin README |
| 7 others | javamark `plugins/*` | skills | EN | 1.0.0 | 0 | dropped |

Repo-level: claude-mods has a root MIT LICENSE; javamark-claude-plugins has none and uses `owner.email: mark@example.de`; both marketplaces lack `owner.url`; claude-mods' README states the repo is private.
