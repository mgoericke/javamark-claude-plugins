---
description: Plan and generate token budget infrastructure for LLM applications
---

# /token-budget

Generate token budget infrastructure for: $ARGUMENTS

Start with a brief interview (skip questions already answered by the arguments):

1. Which use case? (Context / Cost / Quota / Combination)
2. Which LLM provider? (Ollama / OpenAI / Anthropic / other)
3. How many services/agents make LLM calls?
4. Is there a monthly monetary budget?
5. Which framework? (Quarkus + LangChain4j is default)
6. Should token usage be persisted? (In-memory for dev, DB for production)

Then read the appropriate reference file(s) from the token-budget skill's `references/` directory and generate the implementation.
