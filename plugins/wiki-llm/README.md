# wiki-llm

**A knowledge base in Obsidian that Claude writes and you read.**

You collect sources. Claude turns them into linked pages for people, products and concepts, notes contradictions, and keeps the index up to date. Every new source and every answer makes the wiki richer. It is plain Markdown: no embeddings, no database, and Obsidian's graph view works out of the box.

The idea follows Andrej Karpathy's LLM wiki.

## Set up

```bash
/plugin install wiki-llm@javamark-claude-plugins
/wiki-init
```

`/wiki-init` sets up an existing Obsidian vault or a new folder and never overwrites anything. Obsidian itself is optional.

The plugin looks for the wiki in this order:

1. the `WIKI_ROOT` environment variable
2. a `WIKI_ROOT: <path>` line in the project's `CLAUDE.md`
3. the vaults registered in Obsidian, if exactly one of them is a wiki
4. `~/wiki`

## Work with it

| Situation | Command |
|-----------|---------|
| Clipped an article | `/wiki-ingest <file>`, or without a file to see what is open |
| "How did we solve X?" | `/wiki <question>` |
| Keep one insight from this session | `/wiki-save <topic>` |
| End of a work session | `/wiki-save-session` |
| Find missing links | `/wiki-connect` |
| See size and problems | `/wiki-status` |
| Full audit | ask for wiki maintenance, the `wiki-curator` skill takes over |

Claude shows drafts before writing and discusses a source with you before ingesting it.

## Structure

```
vault/
├── CLAUDE.md      # the rules, yours to change
├── index.md       # catalog of all pages
├── log.md         # what happened, append-only
├── Clippings/     # optional inbox of the Obsidian Web Clipper
├── raw/           # your sources, Claude never changes them
└── wiki/
    ├── sources/   # one summary per source
    ├── entities/  # people, organizations, products
    ├── concepts/  # ideas and terms
    └── analyses/  # filed answers, decisions, recipes, session learnings
```

Pages link with `[[wikilinks]]`. The vault's `CLAUDE.md` wins over the plugin's defaults, see [references/vault-schema.md](references/vault-schema.md).

`scripts/wiki.mjs check` reports broken links, orphans, index gaps and sources not ingested yet. It only reads.

## Upgrading from 1.x

Version 2 replaces the `concepts/recipes/decisions/...` layout, `WIKI_INDEX.md` and `related:` frontmatter. Old entries are not migrated: run `/wiki-init` in a vault and bring them over with `/wiki-save`.
