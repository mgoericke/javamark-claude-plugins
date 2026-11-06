---
description: Turn a source from raw/ or Clippings/ into linked wiki pages
---

# /wiki-ingest

Ingest `$ARGUMENTS`.

1. Find the wiki: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root`. Without a wiki, suggest `/wiki-init`.
2. Read the vault's `CLAUDE.md`. If it has none, read `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`.
3. Without arguments, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" check`, list the sources not ingested yet and ask which one to take.
4. Check whether the source was ingested before: search `log.md` for its file name and title, and the pages for its `source_file`. If it was, follow "Repeated ingest" below.
5. Follow the INGEST workflow. Step 2 of it is not optional: discuss the takeaways and wait for the user before writing.

`raw/` and `Clippings/` stay untouched. Set `source_file` to the file's real path, also for `Clippings/`.

## Repeated ingest

A source that was ingested before is not new. Tell the user what the log says and which pages are missing, then:

- Recreate only what is missing. Leave existing pages alone unless the source adds something they lack.
- Do not raise `source_count` on a page that already counts this source.
- Keep the original `date_ingested`.
- Say in the `log.md` entry that this is a repeat, and why it was needed.
