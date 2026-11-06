---
description: Turn a source from raw/ or Clippings/ into linked wiki pages
---

# /wiki-ingest

Ingest `$ARGUMENTS`.

1. Find the wiki: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root`. Without a wiki, suggest `/wiki-init`.
2. Read the vault's `CLAUDE.md`. If it has none, read `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`.
3. Without arguments, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" check`, list the sources not ingested yet and ask which one to take.
4. Follow the INGEST workflow. Step 2 of it is not optional: discuss the takeaways and wait for the user before writing.

`raw/` and `Clippings/` stay untouched. Set `source_file` to the file's real path, also for `Clippings/`.
