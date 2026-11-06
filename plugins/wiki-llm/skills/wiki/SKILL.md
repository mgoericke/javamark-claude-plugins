---
name: wiki
description: Activate when the user asks a question that might be answered by their personal knowledge base, references past solutions, asks about patterns or decisions, or says "check the wiki", "do we have a note on", "what did we decide about", or "how did we solve X before".
---

# Wiki

The user's wiki is an Obsidian vault of linked Markdown pages, written and maintained by you. Use it as a source when a question might be answered there.

## Find it

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs" root`. It checks `$WIKI_ROOT`, a `WIKI_ROOT:` line in the project's `CLAUDE.md`, the vaults registered in Obsidian, then `~/wiki`.

| Exit | Meaning | Do |
|---|---|---|
| 0 | found, path on stdout | go on |
| 1 | no wiki | suggest `/wiki-init` |
| 2 | configured folder is no wiki yet | suggest `/wiki-init` |
| 3 | several wikis, candidates on stderr | ask which one |

## Answer

The vault's `CLAUDE.md` holds the rules. If it has none, use `${CLAUDE_PLUGIN_ROOT}/references/vault-schema.md`. Ignore its session start protocol when you work from another project.

1. Read `index.md` and pick the pages that fit. It is the catalog, so start there, not with a full-text search.
2. If the index gives nothing, search the page contents with Grep inside `wiki/`.
3. Read the pages and follow their links where it helps.
4. Answer in your own words, and name the pages you used. Link them as `obsidian://open?vault=<vault folder name>&file=<path without .md, URL-encoded>`, so a click opens Obsidian.
5. Say what the wiki does not know. Mark anything from your own knowledge as such.
6. If the answer is substantial, offer to file it as an analysis page.

If nothing fits, say so and offer `/wiki-save <topic>`.

## Never

- Change `raw/` or `Clippings/`.
- Write a page without showing the draft first.
- Leave `index.md` or `log.md` behind after a write.

## CLAUDE.md for a project

Recommend this when the user wants a project to use the wiki:

```markdown
## Wiki (wiki-llm)
- Consult /wiki before answering questions about past solutions and decisions
- Save learnings with /wiki-save-session at the end of a work session
```
