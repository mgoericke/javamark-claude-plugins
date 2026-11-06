---
description: Show the wiki's size, last activity, and what needs attention
---

# /wiki-status

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" check` and show the result as a short overview: pages by type, last log entry, top tags, then each problem group with its count. Do not change anything.

End with the next useful step: `/wiki-ingest` for open sources, `/wiki-connect` for orphans, the `wiki-curator` skill for broken links. If no wiki is found, suggest `/wiki-init`.
