---
description: Create a bilingual technical blog post (EN + DE) from a Java/Quarkus project
---

# /blog

Create a technical blog post about: $ARGUMENTS

## Behavior

**With a module or topic argument** (e.g., `/blog applicationreview` or `/blog agentic-coding-assistant`):
- Read that module's `CLAUDE.md` and `README.md`
- Analyze that module specifically
- Write `BLOG.md` (English) and `BLOG_DE.md` (German) in the module root

**Without an argument:**
- Analyze the current project
- Suggest 3 blog post topics with a recommended post type for each (Architecture, Tutorial, Deep Dive, Benchmark)
- Wait for the user to choose before writing

## Output

The blog-writer agent produces:

| File | Language |
|---|---|
| `BLOG.md` | English — Substack-ready |
| `BLOG_DE.md` | German — natural translation, not literal |

Both files are placed in the project or module root.

After writing, the agent prints a **cover image prompt** to the terminal for use with Gemini or napkin.ai.
