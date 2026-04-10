---
description: Show wiki statistics — entry counts, tag cloud, stale entries, drafts, and orphaned nodes
---

# /wiki-status

Display a health dashboard for the personal wiki.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`
   - If the wiki does not exist, say so and suggest `/wiki-init`

2. **Gather statistics** using Bash tools:

```bash
WIKI="~/wiki"  # replace with resolved path

# Count entries per category
for dir in concepts recipes decisions troubleshooting tools references journal; do
  count=$(find "$WIKI/$dir" -name "*.md" 2>/dev/null | wc -l)
  echo "$dir: $count"
done

# Total entries
find "$WIKI" -name "*.md" -not -name "WIKI_INDEX.md" -not -name "WIKI_MAP.md" | wc -l

# Draft entries
grep -r "status: draft" "$WIKI" --include="*.md" -l

# Entries with status: evergreen
grep -r "status: evergreen" "$WIKI" --include="*.md" -l | wc -l

# Orphaned entries (empty related list)
grep -r "^related: \[\]" "$WIKI" --include="*.md" -l

# All tags (frequency)
grep -r "^tags:" "$WIKI" --include="*.md" -h | sed 's/tags: //' | tr -d '[]' | tr ',' '\n' | tr -d ' ' | sort | uniq -c | sort -rn | head -20

# Recently updated entries
grep -r "^updated:" "$WIKI" --include="*.md" -h | sort -r | head -10

# Stale entries (updated more than 90 days ago)
TODAY=$(date +%Y-%m-%d)
grep -r "^updated:" "$WIKI" --include="*.md" -rl
```

3. **Calculate stale entries**: Compare `updated:` dates in frontmatter against today's date. Flag entries not updated in the last 90 days.

4. **Present the dashboard**:

```
## Wiki Status — YYYY-MM-DD
Wiki root: ~/wiki

### Entries by Category
| Category        | Count |
|-----------------|-------|
| concepts/       |    12 |
| recipes/        |    24 |
| decisions/      |     8 |
| troubleshooting/|    15 |
| tools/          |     9 |
| references/     |     6 |
| journal/        |    18 |
| **Total**       |**92** |

### Quality Indicators
- Evergreen entries: 31 (34%)
- Draft entries: 14 (15%) ← needs attention
- Orphaned entries (no related links): 8
- Stale entries (90+ days): 6

### Top Tags
kafka (18) · spring-boot (15) · keycloak (12) · docker (11) · postgresql (9) · ...

### Recently Updated
- 2024-01-15 [Fix for Kafka consumer offset reset](troubleshooting/kafka-offset-reset.md)
- 2024-01-12 [Keycloak PKCE flow setup](recipes/keycloak-pkce.md)
- ...

### Needs Attention

**Draft entries** (consider reviewing and promoting to `reviewed`):
- [Entry title](path/to/file.md) — created YYYY-MM-DD

**Stale entries** (not updated in 90+ days):
- [Entry title](path/to/file.md) — last updated YYYY-MM-DD

**Orphaned entries** (no related links — consider `/wiki-connect`):
- [Entry title](path/to/file.md)

---
Run `/wiki-connect` to add missing links.
Run `/wiki-curator` for a full maintenance audit.
```

## Notes

- If the wiki is empty, show a friendly "Your wiki is empty" message and suggest `/wiki-init`
- If WIKI_INDEX.md is missing or outdated, flag it and offer to regenerate
- The stale threshold is 90 days — this can be adjusted if the user prefers a different window
