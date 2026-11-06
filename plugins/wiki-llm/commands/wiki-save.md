---
description: Save an insight from the current conversation to the wiki
---

# /wiki-save

Save what this conversation found out about `$ARGUMENTS`. If the topic is empty, ask for it.

1. Find the wiki: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root`. Without a wiki, suggest `/wiki-init`.
2. Read the vault's `CLAUDE.md`. If it has none, read `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`.
3. Follow the SAVE workflow from `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`, also when the vault's own `CLAUDE.md` has no such section.
4. Tags follow `${CLAUDE_PLUGIN_ROOT}/references/tagging-guidelines.md`, unless the vault already uses another spelling for the same thing.

Rules:
- Never write without showing the draft first.
- One topic per page. Suggest splitting a broad topic.
- Link every entity and concept that has a page.
- Report the files written.
