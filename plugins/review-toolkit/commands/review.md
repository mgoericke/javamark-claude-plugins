---
description: Run a systematic code review with specialized agents
---

# /review

Perform a code review for the following topic/directory: $ARGUMENTS

Use the specialized review agents in this order:

1. **architecture-reviewer**: BCE compliance, package structure, dependencies
2. **security-reviewer**: OWASP, LLM injection, secrets, GDPR
3. **performance-reviewer**: N+1 queries, embedding performance, reactive patterns

Consolidate the results of all three reviews into a single report with:
- Critical findings (merge blockers)
- Improvement suggestions (before production)
- Positive aspects
- Prioritized action list

If no specific directory was given, analyze the most recently changed files (git diff).
