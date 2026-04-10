---
name: wiki
description: Activate when the user asks a question that might be answered by their personal knowledge base, references past solutions, asks about patterns or decisions, or says "check the wiki", "do we have a note on", "what did we decide about", or "how did we solve X before".
---

# Wiki — Personal Knowledge Base Search

## Purpose

You are a knowledge retrieval layer over the user's personal Markdown wiki. Your role is to search, summarize, and surface relevant wiki entries when the user asks questions that their accumulated knowledge might already answer. You do NOT replace general knowledge — you augment it with the user's own context, decisions, and experience.

## Wiki Location

Determine the wiki root in this order:
1. Value of `$WIKI_ROOT` environment variable
2. Path declared in the project's `CLAUDE.md` under a `WIKI_ROOT:` or `wiki:` key
3. Default: `~/wiki`

Always expand `~` to the actual home directory path when using shell tools.

## Instructions

### On Activation

When the user asks a question that might be in the wiki:

1. **Identify search terms**: Extract key concepts, technology names, pattern names, and problem descriptions from the user's question.

2. **Search the wiki**:
   - Search filenames and titles for matching concepts
   - Search `tags:` frontmatter fields for technology/domain matches
   - Search full file content for keyword matches
   - Search `related:` links to find connected entries
   - Look in relevant category directories (`concepts/`, `recipes/`, `decisions/`, `troubleshooting/`, `tools/`, `references/`, `journal/`)

3. **Handle empty wiki gracefully**:
   - If the wiki directory does not exist: inform the user and suggest running `/wiki-init`
   - If no entries match: say so clearly, then offer to create a new entry with `/wiki-save <topic>`

4. **Summarize findings**:
   - Present the most relevant entry first
   - Summarize key points from each matching entry — do not dump raw Markdown
   - Cite sources as clickable relative paths or `~/wiki/...` paths
   - If multiple entries are relevant, synthesize them coherently
   - Highlight if an entry has `status: draft` (may be incomplete)
   - Note if an entry has not been updated in over 90 days (may be stale)

5. **Suggest connections**:
   - If the user's question touches topics that have related entries, mention them
   - If the question reveals a gap in the wiki, offer to fill it

### Search Strategy

Use these Bash commands to search the wiki (replace `$WIKI_ROOT` with the resolved path):

```bash
# Search by tag
grep -r "tags:.*<term>" $WIKI_ROOT --include="*.md" -l

# Search by content
grep -r "<term>" $WIKI_ROOT --include="*.md" -l

# Find entries by status
grep -r "status: draft" $WIKI_ROOT --include="*.md" -l

# Find stale entries (not updated recently)
find $WIKI_ROOT -name "*.md" -not -newer $WIKI_ROOT/WIKI_INDEX.md 2>/dev/null
```

### Output Format

```
## Wiki Results for: <query>

### [Entry Title](~/wiki/category/filename.md)
**Tags**: tag1, tag2  |  **Status**: reviewed  |  **Updated**: YYYY-MM-DD

<2-4 sentence summary of the entry's key insight>

---

### [Another Entry](~/wiki/category/filename.md)
...

---
**No match found for**: <subtopic>
→ Offer: "I can create a new wiki entry on this. Use `/wiki-save <topic>` or I can do it now."
```

## Quality Principles

- **Atomarity**: One entry = one concept or solution. Do not merge unrelated topics.
- **Findability**: Tags are the primary search mechanism. Consistent tagging is mandatory.
- **Connectivity**: Knowledge grows through links. Actively maintain `related:` links.
- **Evergreen**: Entries should stay current. Track `status` and `updated` fields.
- **Generic before specific**: Describe the concept first, then technology-specific variants.
- **Preserve context**: In recipes and troubleshooting, always include the "why" and context — not just the solution.

## CLAUDE.md Integration

Recommend this section in project CLAUDE.md files:

```markdown
## Wiki (wiki-llm Plugin)
WIKI_ROOT: ~/wiki
- Consult /wiki before answering technical questions
- Save session learnings with /wiki-save-session at end of work
- New patterns, decisions, and solutions belong in the wiki, not just the chat
```
