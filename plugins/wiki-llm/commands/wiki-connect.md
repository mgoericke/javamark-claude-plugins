---
description: Analyze wiki entries for semantic connections and propose missing related links
---

# /wiki-connect

Analyze all wiki entries, identify semantic connections, and propose missing `related:` links between entries. Optionally generate a Mermaid knowledge map.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`
   - If the wiki is empty or does not exist, say so.

2. **Load all wiki entries**: Read every `.md` file recursively. For each entry extract:
   - Filename and path
   - `title`, `tags`, `related`, `status`
   - First 200 characters of body content (for semantic matching)

3. **Build a tag-based connection graph**:
   - Group entries by shared tags
   - Entries sharing 2+ tags are strong candidates for `related:` links
   - Entries sharing 1 tag are weak candidates

4. **Identify missing links**: For each entry, find entries that share significant tags but are NOT already listed in its `related:` field. These are missing connections.

5. **Semantic analysis**: Beyond tags, look for:
   - Entries that mention each other's titles in their content
   - Entries in `recipes/` that reference concepts from `concepts/`
   - `troubleshooting/` entries related to `tools/` or `recipes/` entries
   - `decisions/` entries that motivated entries in other categories

6. **Present proposed links** grouped by entry:

```
## Proposed Connections

### concepts/event-driven-architecture.md
Missing `related:` links:
- ✅ `recipes/kafka-consumer-setup.md` — shares tags: kafka, event-driven
- ✅ `decisions/why-kafka-over-rabbitmq.md` — shares tags: kafka, messaging
- ⚠️  `troubleshooting/consumer-lag.md` — shares tag: kafka (weak match)

### recipes/kafka-consumer-setup.md
Missing `related:` links:
- ✅ `concepts/event-driven-architecture.md` — shares tags: kafka, event-driven

---
Total: 8 missing links across 5 entries.

Apply all ✅ strong matches? (y/n/select)
```

7. **Wait for user confirmation** before writing any changes.

8. **Apply confirmed links**: For each confirmed connection, add the filename to the `related:` list in both entries' frontmatter (bidirectional linking).

9. **Optional: Generate Mermaid knowledge map**:

   Ask: "Shall I also generate a Mermaid graph of the wiki connections?"

   If yes, generate:
   ```markdown
   ## Wiki Knowledge Map
   
   ```mermaid
   graph TD
     A[concepts/event-driven-arch] --> B[recipes/kafka-setup]
     A --> C[decisions/kafka-vs-rabbitmq]
     B --> D[troubleshooting/consumer-lag]
   ```
   ```

   Save as `~/wiki/WIKI_MAP.md`.

10. **Update WIKI_INDEX.md** after all changes are applied.

## Notes

- Connections are bidirectional: if A relates to B, then B also relates to A
- Never remove existing `related:` links — only add new ones
- Do not propose connections between entries with no meaningful relationship just because they share a broad tag like `java` or `backend`
- After running `/wiki-connect`, run `/wiki-status` to see the updated orphan count
