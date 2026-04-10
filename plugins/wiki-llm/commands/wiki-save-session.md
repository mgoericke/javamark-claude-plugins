---
description: Extract all notable learnings from the current session and save them as wiki entries
---

# /wiki-save-session

Review the entire current conversation and extract all knowledge worth preserving in the wiki.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`

2. **Scan the full conversation** for knowledge worth preserving. Look for:
   - Solutions to non-trivial problems
   - Architectural or design decisions made
   - Patterns or approaches discovered or validated
   - Configuration or tooling insights
   - Debugging insights and root causes
   - Concepts explained or clarified
   - Things that surprised or were unexpected
   - Anything the user said "I didn't know that" or "good to know" about

3. **Extract candidate learnings**: For each notable item, capture:
   - Topic / title
   - Category suggestion (`concepts/`, `recipes/`, `decisions/`, `troubleshooting/`, `tools/`, `references/`, `journal/`)
   - One-line summary
   - Full content (from conversation)
   - Tags

4. **Present the candidates** as a numbered list for user selection:

```
## Session Learnings — <date>

I found N items worth saving to the wiki. Select which ones to save (e.g. "1, 3, 5" or "all"):

1. [recipes] **How to configure X** — Step-by-step solution for Y using Z
2. [decisions] **Why we chose A over B** — Decision rationale with context
3. [troubleshooting] **Fix for error "foo"** — Root cause was X, solution is Y
4. [concepts] **Understanding Z pattern** — Explanation of how Z works and when to use it
5. [journal] **Session summary: refactoring auth module** — Notes from today's session

Or: save all as a single journal entry under `journal/YYYY-MM-DD-session.md`
```

5. **Wait for user selection** before writing anything.

6. **For each selected item**:
   - Draft the wiki entry with full frontmatter
   - Show the draft to the user
   - On confirmation, write to `~/wiki/<category>/<kebab-case-title>.md`

7. **Journal entry option**: If the user selects "journal", create a single consolidated entry:
   ```
   ~/wiki/journal/YYYY-MM-DD-<topic>.md
   ```
   with all session learnings summarized under one file.

8. **Update WIKI_INDEX.md**: Add all new entries to the index after saving.

9. **Final report**:
   ```
   Saved N wiki entries:
   - ~/wiki/recipes/configure-x.md
   - ~/wiki/decisions/a-over-b.md
   ...
   
   WIKI_INDEX.md updated.
   ```

## Notes

- Prefer separate atomic entries over one large journal dump — unless the user chooses the journal option
- Do not save trivial exchanges, tool outputs, or debugging noise — only genuine insights
- If the session was short and had no notable learnings, say so honestly
- Always confirm before writing — never auto-save without user approval
- Items that are already in the wiki (found via search) should be flagged as "possible update" rather than new entry
