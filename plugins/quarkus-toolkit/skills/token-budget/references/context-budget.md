# Context Budget Reference

## Overview

Context budgets ensure that the total content sent to the LLM fits within the model's context window. This is critical for quality — if you exceed the window, content gets truncated and the LLM loses important information.

## Architecture

```
┌─────────────────────────────────────┐
│         Context Window (e.g. 128k)  │
├─────────────────────────────────────┤
│  System Prompt        (fixed)       │
│  Memory / RAG Context (variable)    │
│  Conversation History (variable)    │
│  User Message         (variable)    │
│  Response Reserve     (fixed)       │
└─────────────────────────────────────┘
```

## Key Artifacts

### 1. TokenEstimator

Estimates token count before sending to the LLM.

```java
@ApplicationScoped
public class TokenEstimator {

    @ConfigProperty(name = "token-budget.chars-per-token", defaultValue = "4.0")
    double charsPerToken;

    public int estimate(String text) {
        if (text == null || text.isBlank()) return 0;
        return (int) Math.ceil(text.length() / charsPerToken);
    }

    public int estimate(List<String> texts) {
        return texts.stream().mapToInt(this::estimate).sum();
    }

    public double getCharsPerToken() {
        return charsPerToken;
    }
}
```

### 2. TokenBudgetService

Manages budget allocation and prioritization.

```java
@ApplicationScoped
public class TokenBudgetService {

    @Inject TokenEstimator estimator;

    @ConfigProperty(name = "token-budget.context.max-tokens", defaultValue = "8000")
    int maxTokens;

    @ConfigProperty(name = "token-budget.context.system-prompt-reserve", defaultValue = "1000")
    int systemPromptReserve;

    @ConfigProperty(name = "token-budget.context.response-reserve", defaultValue = "2000")
    int responseReserve;

    /**
     * Build context that fits within the token budget.
     * Components are added in priority order — lower priority items
     * get trimmed or dropped when the budget is exhausted.
     */
    public ContextResult buildContext(ContextRequest request) {
        int available = maxTokens - systemPromptReserve - responseReserve;
        var included = new ArrayList<ContextComponent>();
        int used = 0;

        // Components are pre-sorted by priority (highest first)
        for (var component : request.components()) {
            int cost = estimator.estimate(component.content());
            if (used + cost <= available) {
                included.add(component);
                used += cost;
            } else {
                // Try to include a truncated version
                int remaining = available - used;
                if (remaining > 100) { // minimum useful size
                    String truncated = truncateToTokens(component.content(), remaining);
                    included.add(component.withContent(truncated));
                    used += remaining;
                }
                break;
            }
        }

        Log.infof("Context budget: %d/%d tokens used (%.0f%%)",
            used, available, (used * 100.0) / available);
        return new ContextResult(included, used, available);
    }

    private String truncateToTokens(String text, int targetTokens) {
        int charLimit = (int) (targetTokens * estimator.getCharsPerToken());
        if (text.length() <= charLimit) return text;
        return text.substring(0, charLimit) + "\n[... truncated]";
    }
}
```

### 3. Supporting Records

```java
public record ContextComponent(
    String name,
    String content,
    int priority  // 1 = highest
) {
    public ContextComponent withContent(String newContent) {
        return new ContextComponent(name, newContent, priority);
    }
}

public record ContextRequest(List<ContextComponent> components) {
    public ContextRequest {
        components = components.stream()
            .sorted(Comparator.comparingInt(ContextComponent::priority))
            .toList();
    }
}

public record ContextResult(
    List<ContextComponent> included,
    int tokensUsed,
    int tokensAvailable
) {}
```

### 4. Configuration

```properties
# Context Budget
token-budget.chars-per-token=4.0
token-budget.context.max-tokens=8000
token-budget.context.system-prompt-reserve=1000
token-budget.context.response-reserve=2000
```

## Prioritization Strategies

Offer the user a choice:

| Strategy | Description |
|----------|-------------|
| **Fixed Priority** | Each component has a static priority (system > memory > history > RAG) |
| **Recency** | Newer conversation turns get higher priority |
| **Relevance** | RAG chunks sorted by similarity score, highest first |
| **Hybrid** | Fixed priority for categories, relevance-sorted within each category |

## Logging

Every LLM call should log:
- Total tokens used vs. budget
- Which components were included/excluded
- Percentage of budget consumed
