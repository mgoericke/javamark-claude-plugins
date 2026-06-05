---
name: blog-post
description: Transforms Java/Quarkus projects into engaging technical blog posts. Use this skill when a blog article, tutorial, or technical introduction should be created from a project.
---

# Blog-Post Skill

## Purpose

Create developer-focused blog posts that present technical projects honestly, concisely, and with actionable takeaways. Covers project analysis, writing, bilingual output, and cover image prompt generation.

## Post Types

Choose the type before writing:

| Type | Structure | Word count |
|---|---|---|
| **Architecture / System Design** | Problem → Architecture → Implementation → Trade-offs → Results | 2000–3500 |
| **Tutorial / How-To** | End result first → Prerequisites → Steps → Complete code → Next steps | 1500–3000 |
| **Deep Dive / Explainer** | What + why → Mental model → Mechanics → Example → Trade-offs | 2000–4000 |
| **Benchmark / Comparison** | What + why → Methodology → Results → Analysis → Recommendation | 1500–2500 |

Default for Quarkus/agentic projects: **Architecture / System Design**.

## Required Sections

Every post must include all of these:

1. **TL;DR** — 2–3 sentences at the very top. If it's a local LLM pipeline, include "code never leaves your machine."
2. **The Problem** — Specific and relatable. Skip generic openers.
3. **Core content** — Architecture, code snippets, key decisions.
4. **Trade-offs and Limitations** — Non-negotiable. Honest downsides build trust. Skipping this reads as marketing.
5. **Next Steps** — Concrete roadmap items, not vague promises.
6. **Further Reading** — 3–5 links.

## Code Example Rules

- Every code block must be runnable as shown — broken examples destroy credibility
- Language identifier in every fenced block: ` ```java `, ` ```yaml `, ` ```bash `
- Pin versions explicitly: `// Quarkus 3.35.1, Java 25`
- Show output after the code where useful
- Realistic names — never `foo`, `test`, `myMethod`
- Include error handling where it matters

## Agent / Pipeline Table Template

For agentic pipeline posts, always include a table of agents and scope keys:

```markdown
| Agent | Role | Scope key |
|---|---|---|
| `Coder` | Writes initial code from the spec | `code` |
| `Reviewer` | Quality check — `APPROVED` or `FAILED: <reason>` | `review_status` |
| `Editor` | Rewrites code on failure | `code` |
| `SecurityReviewer` | OWASP-style security pass | `security_status` |
| `SecurityEditor` | Patches security issues | `code` |
```

Also describe loop structure explicitly:

```markdown
**Review loop** (`Reviewer ↔ Editor`) — runs up to N iterations until `APPROVED`.
**Security loop** (`SecurityEditor ↔ SecurityReviewer`) — runs until `APPROVED`.
```

## GDPR / DSGVO Paragraph Template

Include when the pipeline runs on a local LLM (Ollama, LM Studio, etc.):

**English (`BLOG.md`):**
> Because the pipeline runs entirely on local hardware with Ollama, no code ever leaves your machine. For teams working with proprietary code, client data, or under GDPR constraints, that's not a nice-to-have — it's a requirement.

**German (`BLOG_DE.md`):**
> Weil die Pipeline vollständig auf lokaler Hardware mit Ollama läuft, verlässt kein Code die eigene Maschine. Für Teams, die mit proprietärem Code, Kundendaten oder unter DSGVO-Anforderungen arbeiten, ist das keine Komfortfunktion — sondern eine Voraussetzung.

## Output Format

Always produce two files in the project root:

| File | Language | Notes |
|---|---|---|
| `BLOG.md` | English | Substack-ready Markdown |
| `BLOG_DE.md` | German | Natural translation — not literal; adapt idioms |

After both files are written, print a **cover image prompt** to the terminal (see the agent for the template).

## What Developers Hate

Avoid these unconditionally:

```
❌ "In today's fast-paced world of technology..."
❌ "Simply do X" / "Just add X" / "It's easy to..." / "Obviously..."
❌ "As we all know..."
❌ Unpinned dependency versions in code examples
❌ Broken or incomplete code snippets
❌ No trade-offs section (reads as vendor marketing)
❌ 3-paragraph introduction before getting to the point
❌ Abstract descriptions where a diagram would do the job
```
