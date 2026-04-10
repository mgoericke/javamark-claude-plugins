---
description: Initialize the wiki directory structure with folders, index, and an example entry
---

# /wiki-init

Initialize the personal wiki directory structure. This command is idempotent — it will not overwrite existing files, only create what is missing.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`

2. **Check if wiki already exists**:
   - If the directory exists and has content, report what is already there and only create missing parts
   - If it does not exist, create it with full scaffolding

3. **Create directory structure** (skip any that already exist):
   ```
   ~/wiki/
   ├── concepts/
   ├── recipes/
   ├── decisions/
   ├── troubleshooting/
   ├── tools/
   ├── references/
   └── journal/
   ```

   Use Bash:
   ```bash
   mkdir -p ~/wiki/{concepts,recipes,decisions,troubleshooting,tools,references,journal}
   ```

4. **Create WIKI_INDEX.md** (only if it does not exist):

```markdown
# Wiki Index
_Last updated: YYYY-MM-DD_

Personal knowledge base — plain Markdown, Git-versioned, searchable by Claude Code.
Inspired by [Karpathy's Wiki-LLM concept](https://x.com/karpathy).

## By Category

### concepts/
_Architectural patterns, principles, abstract ideas_
<!-- entries will appear here -->

### recipes/
_Step-by-step solutions and how-tos_
<!-- entries will appear here -->

### decisions/
_Architecture Decision Records (ADRs) — why was what chosen_
<!-- entries will appear here -->

### troubleshooting/
_Problems, root causes, and solutions_
<!-- entries will appear here -->

### tools/
_Tool-specific knowledge, configuration, and tips_
<!-- entries will appear here -->

### references/
_Links, cheatsheets, and quick-reference material_
<!-- entries will appear here -->

### journal/
_Session notes, learnings, and observations_
<!-- entries will appear here -->

---

## By Tag
_This section is auto-generated. Run `/wiki-connect` or `/wiki-curator` to refresh._

---

## Quick Start

- Search: `/wiki <question or topic>`
- Save current session learnings: `/wiki-save-session`
- Save a specific insight: `/wiki-save <topic>`
- Connect related entries: `/wiki-connect`
- Health check: `/wiki-status`
- Full maintenance audit: `/wiki-curator`
```

5. **Create an example entry** at `~/wiki/concepts/wiki-getting-started.md` (only if no entries exist yet):

```markdown
---
title: Getting Started with Wiki-LLM
tags: [wiki, knowledge-management, claude-code]
created: YYYY-MM-DD
updated: YYYY-MM-DD
related: []
status: evergreen
---

# Getting Started with Wiki-LLM

## Context

This wiki is a personal, LLM-powered knowledge base. It lives as plain Markdown files on your local machine, can be Git-versioned, and is fully searchable by Claude Code without any external tooling or embeddings.

Inspired by Andrej Karpathy's Wiki-LLM concept: your own second brain, made traversable by an LLM.

## How It Works

- **You** write Markdown entries in structured categories
- **Claude Code** searches, summarizes, and connects them
- **Tags** are the primary navigation mechanism — keep them consistent
- **Related links** create a knowledge graph — the more connections, the more useful

## Key Commands

| Command | Purpose |
|---------|---------|
| `/wiki <query>` | Search the wiki |
| `/wiki-save <topic>` | Save an insight from the current session |
| `/wiki-save-session` | Extract all learnings from the current session |
| `/wiki-connect` | Find and add missing cross-links |
| `/wiki-status` | Health dashboard |
| `/wiki-curator` | Full maintenance audit |

## Notes

- Keep entries atomic: one concept per file
- Update `updated:` and `status:` as entries mature
- Run `/wiki-save-session` at the end of each significant work session
```

6. **Check for Git initialization** (optional):
   - If `~/wiki` is not a Git repo, ask: "Would you like me to initialize a Git repository in `~/wiki`? This enables version history for your knowledge base."
   - Only run `git init ~/wiki` if the user confirms

7. **Report what was created**:
   ```
   Wiki initialized at: ~/wiki
   
   Created:
   ✓ concepts/
   ✓ recipes/
   ✓ decisions/
   ✓ troubleshooting/
   ✓ tools/
   ✓ references/
   ✓ journal/
   ✓ WIKI_INDEX.md
   ✓ concepts/wiki-getting-started.md (example entry)
   
   Already existed (skipped):
   — (nothing)
   
   Next steps:
   - Add the wiki to your project CLAUDE.md (see recommendation below)
   - Start saving knowledge with /wiki-save <topic>
   - At end of sessions, run /wiki-save-session
   ```

8. **Show recommended CLAUDE.md section**:
   ```markdown
   ## Wiki (wiki-llm Plugin)
   WIKI_ROOT: ~/wiki
   - Consult /wiki before answering technical questions
   - Save session learnings with /wiki-save-session at end of work
   - New patterns, decisions, and solutions belong in the wiki, not just the chat
   ```

## Notes

- This command is safe to run multiple times — it never overwrites existing files
- If `$WIKI_ROOT` points to a non-home location, use that path throughout
- Do not create hidden directories or configuration files in the wiki root — keep it plain Markdown
