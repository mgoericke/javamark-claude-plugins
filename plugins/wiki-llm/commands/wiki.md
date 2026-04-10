---
description: Search the personal wiki for information on a topic, concept, or question
---

# /wiki

Search the personal Markdown wiki for knowledge related to `$ARGUMENTS`.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`
   - If the directory does not exist, say so and suggest running `/wiki-init`

2. **Parse the query**: Extract key terms from `$ARGUMENTS` — concepts, technology names, problem descriptions, pattern names.

3. **Search the wiki** using Bash tools:
   ```bash
   # Full-text search
   grep -r "<term>" ~/wiki --include="*.md" -l
   
   # Tag search
   grep -r "tags:.*<term>" ~/wiki --include="*.md" -l
   
   # Title search
   grep -r "^title:.*<term>" ~/wiki --include="*.md" -l -i
   ```

4. **Present results**:
   - Summarize key insights from each matching entry (2-4 sentences per entry)
   - Show source path as a clickable reference: `~/wiki/category/filename.md`
   - Show `status` and `updated` date for each entry
   - Flag `status: draft` entries as potentially incomplete
   - Flag entries with `updated` older than 90 days as potentially stale

5. **If nothing is found**:
   - State clearly: "No wiki entry found for: $ARGUMENTS"
   - Offer: "Shall I create a new entry? Use `/wiki-save $ARGUMENTS` or tell me more and I'll draft it now."

6. **Suggest related entries**: If the search results have `related:` links pointing to other entries, mention them as "You might also find useful:".

## Output Format

```
## Wiki: <query>

### [Entry Title](~/wiki/category/filename.md)
Status: reviewed | Updated: YYYY-MM-DD

<Summary of key insights from this entry>

---

### [Another Entry](~/wiki/category/filename.md)
Status: draft (may be incomplete) | Updated: YYYY-MM-DD

<Summary>

---
*No results for: <subtopic>* → suggest `/wiki-save <subtopic>`
```

If `$ARGUMENTS` is empty, show the `WIKI_INDEX.md` overview or the last 5 updated entries.
