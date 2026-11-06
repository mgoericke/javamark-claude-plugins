---
name: wiki-curator
description: Activate when the user explicitly asks to maintain, clean up, audit, or improve their wiki — phrases like "curate the wiki", "check wiki health", "find missing links", "update the wiki index", "find stale entries", or "wiki maintenance".
---

# Wiki Curator

Keeps the vault healthy. This is the LINT workflow of the vault's rules, with the measurable part done by a script.

## Audit

1. Find the wiki with `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root` and read its `CLAUDE.md`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" check --json`. Trust these numbers, do not recount with grep.
3. Read the pages for what a script cannot judge:
   - claims on one page that contradict another
   - concepts named repeatedly that have no page
   - entities with `source_count` above 1 and thin content
   - two pages on the same topic
   - tag variants (`k8s` and `kubernetes`), see `${CLAUDE_PLUGIN_ROOT}/references/tagging-guidelines.md`
4. Present one prioritized report:

   ```
   ## Wiki audit, YYYY-MM-DD

   High: broken links, contradictions, stale index entries
   Medium: open sources, tag variants, duplicate pages
   Low: orphans, thin pages
   ```

   Group findings with one cause. Twenty broken links to one lost page are one finding.

5. Offer a fix for each item and wait for approval.

## Fixing

- A broken link to a lost page: ask whether to restore the page from its source with `/wiki-ingest`, or to remove the links.
- Delete a page only when the user says so.
- After changes run `check` again and report the difference.
- Append to `log.md` with the operation `lint`.
