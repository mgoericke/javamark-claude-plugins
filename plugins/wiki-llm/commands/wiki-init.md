---
description: Set up a wiki in an Obsidian vault or a new folder, without touching what exists
---

# /wiki-init

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root`:
   - exit 0: a wiki exists. Report it and only add what is missing.
   - exit 2: the printed folder is configured but empty. Use it.
   - exit 1 or 3: show the candidates and ask which vault to use. If there are none, suggest `~/wiki`, which can be opened as a vault later.
2. Create what is missing, never overwrite:
   - `raw/assets/`, `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`, `wiki/analyses/`
   - `CLAUDE.md`, as a copy of `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`
   - `index.md` with the sections Sources, Entities, Concepts and Analyses
   - `log.md` with an `admin` entry
3. If the folder is no Git repository, ask whether to run `git init`.
4. Report what was created and what already existed.
5. If the wiki is neither the only registered Obsidian vault nor `~/wiki`, show this line for the project's `CLAUDE.md`:

   ```markdown
   WIKI_ROOT: <path>
   ```
