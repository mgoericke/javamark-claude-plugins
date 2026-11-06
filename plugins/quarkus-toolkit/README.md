# quarkus-toolkit

**New Quarkus features without the boilerplate, including the budget for their AI services.**

```bash
/plugin install quarkus-toolkit@javamark-claude-plugins
```

| You want | Use | You get |
|----------|-----|---------|
| A new feature | `/scaffold UserProfile` | BCE packages, Panache entity, REST resource, configuration and a `@QuarkusTest` |
| An API contract | ask for an OpenAPI spec | OpenAPI 3.x from a domain spec or existing code |
| A budget in an existing app | `/token-budget` | Context, cost or quota budgets, after a short interview |

## Token budgets

When a new feature contains a LangChain4j AI service, `/scaffold` asks whether it needs a budget. All three hook into `ChatModelListener`, so they work with any provider that reports token usage.

| Budget | Protects | Adds |
|--------|----------|------|
| Context | Quality: what fits into the context window | `TokenBudgetService`, `TokenEstimator` |
| Cost | Money: tokens per month, with alerts | `TokenUsageTracker`, REST endpoints, Flyway migration |
| Quota | Rate: requests and tokens per minute | `TokenRateLimiter`, priority queue, Prometheus metrics |

The templates are written against LangChain4j 1.21.
