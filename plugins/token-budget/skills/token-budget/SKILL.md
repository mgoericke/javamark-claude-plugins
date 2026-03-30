---
name: token-budget
description: Plan, implement, and monitor token budgets for LLM-based applications. Covers three areas — context budgets (fitting content into context windows), cost budgets (tracking spend per user/service/month), and quota/rate budgets (rate limiting LLM calls). Use this skill whenever the user mentions token budgets, token limits, LLM costs, context window management, token tracking, API budgets, rate limiting for LLMs, token usage monitoring, or wants to control how much context is sent to an LLM. Also trigger when the user is building a ChatModelListener, token counter, or usage tracker for LangChain4j/Quarkus.
---

# Token Budget Skill

## Purpose

Help plan, implement, and monitor token budgets in LLM-based applications. Token budgets come in three flavors — often used in combination:

1. **Context Budget (Quality)** — How much fits into the context window?
2. **Cost Budget (Cost)** — How much are we spending on tokens?
3. **Quota Budget (Rate)** — How fast are we consuming tokens?

Each flavor addresses a different concern but they share infrastructure (token counting, tracking, configuration). This skill guides the user through an interview to understand their needs, then generates the appropriate Quarkus/LangChain4j code.

## Interview

Before generating code, ask these questions to understand the scope. Skip questions that are already answered from context.

### Questions

1. **Which use case?** Context / Cost / Quota / Combination?
   - Local LLM (Ollama, LM Studio) → usually only Context is relevant
   - Cloud API (OpenAI, Anthropic) → all three may be relevant

2. **Which LLM provider?** Ollama / LM Studio / OpenAI / Anthropic / Azure OpenAI / other?
   - This determines whether cost tracking makes sense and which token counting approach to use

3. **How many services/agents make LLM calls?**
   - Single service → simpler tracking
   - Multiple services → need per-service budgets and fair scheduling

4. **Is there a monthly monetary budget?**
   - If yes → Cost Budget with alerting thresholds
   - If no → may still want usage visibility

5. **Which framework?** Quarkus + LangChain4j (primary) / Spring + LangChain4j / other?

6. **Should token usage be persisted?**
   - In-memory → fine for dev, resets on restart
   - Database → production-grade, historical data, dashboards

After the interview, determine which budget types to generate and read the corresponding reference file(s) from `references/` for implementation details.

## Implementation Strategy

### Central Hook: ChatModelListener

All three budget types share a common entry point — the `ChatModelListener` from LangChain4j. This CDI bean intercepts every LLM call and provides access to input/output token counts.

```java
@ApplicationScoped
public class TokenTrackingListener implements ChatModelListener {

    @Override
    public void onResponse(ChatModelResponseContext context) {
        var usage = context.response().tokenUsage();
        int inputTokens = usage.inputTokenCount();
        int outputTokens = usage.outputTokenCount();
        // Route to the appropriate budget handler(s)
    }
}
```

This listener is the foundation. Each budget type adds its own logic on top.

### Token Estimation (for pre-call budget checks)

Before sending a request, you often need to estimate how many tokens the content will use. The skill generates a `TokenEstimator` utility:

- **Default heuristic**: 1 token ≈ 4 characters (English text), configurable
- **Word-based**: 1 token ≈ 0.75 words
- **Provider-specific**: Optional integration with tiktoken (OpenAI) or provider tokenizer APIs
- The estimator is used by Context Budget to decide what fits, and by Quota Budget for pre-flight checks

### What Gets Generated

Based on the interview answers, read the appropriate reference file(s) and generate code:

| Use Case | Reference File | Key Artifacts |
|----------|---------------|---------------|
| Context Budget | `references/context-budget.md` | `TokenBudgetService`, `TokenEstimator`, prioritization config |
| Cost Budget | `references/cost-budget.md` | `TokenUsageTracker`, REST endpoints, alert events, Flyway migration |
| Quota Budget | `references/quota-budget.md` | `TokenRateLimiter`, priority queue, Prometheus metrics |

### Technical Constraints

- **Thread-safe**: Use `AtomicLong` / `ConcurrentHashMap` for in-memory tracking
- **No vendor lock-in**: Works with OpenAI, Ollama, LM Studio, Anthropic — the `ChatModelListener` abstracts the provider
- **Metrics**: Compatible with Micrometer/Prometheus via `quarkus-micrometer-registry-prometheus`
- **Configuration**: All budgets configurable via `application.properties` with sensible defaults
- **Framework**: Quarkus + LangChain4j as primary stack, but patterns are transferable

## Output Conventions

Generated code follows these patterns:

- **Package**: `{project.package}.token` (or `{module}.control` if using BCE)
- **CDI**: `@ApplicationScoped` for all services
- **Config**: `@ConfigProperty` with prefix `token-budget`
- **Logging**: `Log.infof()` for budget consumption, `Log.warnf()` for threshold alerts
- **Tests**: `@QuarkusTest` with REST Assured for endpoint testing
