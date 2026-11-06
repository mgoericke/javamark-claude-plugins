---
description: Find missing wikilinks between pages and add the ones you approve
---

# /wiki-connect

1. Find the wiki and read its rules, as in `/wiki-save`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" check --json`. Start with `orphans` and `brokenLinks`.
3. Read the pages. Look for:
   - names of existing pages in plain text, without a link
   - pages sharing two or more specific tags without a link between them
   - concepts named on several pages that have no page yet
4. Present the proposals by page, strong matches first, with a reason for each. A shared broad tag like `java` is no reason.
5. Wait for approval. Add links in the page's matching section (`Related Concepts`, `Related Entities`), in both directions.
6. Append to `log.md` with the operation `update`.

Never remove a link. Never touch `raw/` or `Clippings/`. Obsidian's graph view shows the result, no separate map is needed.
