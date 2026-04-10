---
description: Create a new wiki entry from the current conversation context on the given topic
---

# /wiki-save

Create a new wiki entry about `$ARGUMENTS`, drawing from the current conversation context.

## Steps

1. **Resolve the wiki root**:
   - Check `$WIKI_ROOT` environment variable
   - Check project `CLAUDE.md` for a `WIKI_ROOT:` line
   - Default to `~/wiki`
   - If the wiki does not exist, prompt the user to run `/wiki-init` first

2. **Determine the topic**: Use `$ARGUMENTS` as the entry title. If empty, ask the user what topic to save.

3. **Extract content from conversation**: Review the current session for relevant information on this topic:
   - Solutions and approaches discussed
   - Decisions made and their rationale
   - Commands, code snippets, configurations used
   - Problems encountered and how they were resolved
   - Key concepts explained

4. **Suggest a category** based on content type:
   - `concepts/` — architectural patterns, principles, abstract ideas
   - `recipes/` — step-by-step solutions, "how to do X"
   - `decisions/` — why something was chosen, ADR-style
   - `troubleshooting/` — problem + root cause + solution
   - `tools/` — tool-specific knowledge, configuration, tips
   - `references/` — links, cheatsheets, quick reference
   - `journal/` — session notes, learnings, observations

   Ask: "I suggest saving this in `<category>/`. Does that work, or would you prefer another category?"

5. **Generate the filename**: kebab-case from the topic, e.g. `$ARGUMENTS` → `my-topic-name.md`

6. **Extract tags from context**: Identify technologies, domains, and patterns mentioned. Apply tagging guidelines (lowercase, kebab-case, singular, no spaces).

7. **Draft the entry** using the standard template:

```markdown
---
title: <Topic from $ARGUMENTS>
tags: [<tag1>, <tag2>, <tag3>]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
related: []
status: draft
---

# <Title>

## Context
<Why is this relevant? What problem does it solve or what concept does it capture?>

## Content
<Main body — concept explanation, solution steps, decision rationale, etc.>

## Notes
<Caveats, alternatives considered, links to relevant code or files>
```

8. **Show the draft** to the user and ask: "Shall I save this to `~/wiki/<category>/<filename>.md`? Feel free to edit before confirming."

9. **On confirmation**:
   - Write the file
   - Update `WIKI_INDEX.md` to include the new entry under the correct category
   - Report: "Saved to `~/wiki/<category>/<filename>.md`"

10. **Check for related entries**: After saving, search for existing entries with overlapping tags and suggest adding `related:` links.

## Notes

- Always show the draft before writing — never write without user confirmation
- Prefer atomic entries: one concept per file
- If the topic is broad, suggest splitting into multiple focused entries
- The entry status starts as `draft` — the user can update it to `reviewed` or `evergreen` later
