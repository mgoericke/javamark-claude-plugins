# wiki-llm — Personal LLM-Powered Knowledge Base

> Inspired by Andrej Karpathy's Wiki-LLM concept: your personal second brain, made traversable by Claude Code. Plain Markdown, Git-versioned, no external tooling.

The `wiki-llm` plugin turns a local folder of Markdown files into a searchable, connectable knowledge base. Claude Code acts as the LLM layer — searching full text and tags, summarizing entries, and finding missing cross-links between notes. No embeddings, no databases, no Obsidian required.

**Install:**
```bash
/plugin install wiki-llm@javamark-claude-plugins
```

**Set up your wiki** (once, creates `~/wiki` with folder structure and index):
```bash
/wiki-init
```

**Recommended `CLAUDE.md` addition** for any project:
```markdown
## Wiki (wiki-llm Plugin)
WIKI_ROOT: ~/wiki
- Consult /wiki before answering technical questions
- Save session learnings with /wiki-save-session at end of work
- New patterns, decisions, and solutions belong in the wiki, not just the chat
```

**Core workflow:**

| Situation | Command |
|-----------|---------|
| "How did we solve X before?" | `/wiki <question>` |
| Save an insight from this session | `/wiki-save <topic>` |
| End of work session | `/wiki-save-session` |
| Find missing cross-links | `/wiki-connect` |
| Wiki health check | `/wiki-status` |
| Full maintenance audit | `/wiki-curator` (skill, auto-activates) |

**Wiki structure** — organized by knowledge type, not technology:

```
~/wiki/
├── concepts/        # Patterns, principles, architecture ideas
├── recipes/         # Step-by-step solutions ("how to X")
├── decisions/       # ADRs — why was what chosen
├── troubleshooting/ # Problems + root causes + fixes
├── tools/           # Tool-specific tips and configuration
├── references/      # Cheatsheets and quick-reference
└── journal/         # Session notes and learnings
```

Technology is tracked via `tags:` frontmatter — keeping the structure neutral across Spring Boot, Quarkus, React, DevOps, or anything else.

**Skills** activate automatically: the `wiki` skill surfaces relevant entries when you ask about past solutions or patterns. The `wiki-curator` skill runs a full quality audit when you ask for wiki maintenance.
