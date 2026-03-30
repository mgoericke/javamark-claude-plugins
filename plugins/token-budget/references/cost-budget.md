# Cost Budget Reference

## Overview

Cost budgets track token consumption in monetary terms and enforce spending limits per user, service, or time period. Essential for cloud LLM APIs where every token costs money.

## Architecture

```
ChatModelListener
       │
       ▼
TokenUsageTracker ──→ UsageRepository (In-Memory or DB)
       │
       ├──→ CDI Events (threshold alerts)
       └──→ REST Endpoints (usage dashboard)
```

## Key Artifacts

### 1. TokenUsageTracker

Central service that records every LLM call's token usage.

```java
@ApplicationScoped
public class TokenUsageTracker implements ChatModelListener {

    @Inject UsageRepository repository;
    @Inject Event<TokenBudgetAlert> alertEvent;

    @ConfigProperty(name = "token-budget.cost.monthly-limit", defaultValue = "1000000")
    long monthlyTokenLimit;

    @ConfigProperty(name = "token-budget.cost.alert-thresholds", defaultValue = "0.8,0.9,1.0")
    List<Double> alertThresholds;

    @Override
    public void onResponse(ChatModelResponseContext context) {
        var usage = context.response().tokenUsage();
        String service = extractServiceName(context);

        var record = new UsageRecord(
            service,
            usage.inputTokenCount(),
            usage.outputTokenCount(),
            Instant.now()
        );

        repository.save(record);
        checkThresholds(service);
    }

    private void checkThresholds(String service) {
        long currentUsage = repository.getMonthlyTotal();
        double ratio = (double) currentUsage / monthlyTokenLimit;

        for (double threshold : alertThresholds) {
            if (ratio >= threshold && !repository.isAlertSent(threshold)) {
                alertEvent.fire(new TokenBudgetAlert(
                    service, threshold, currentUsage, monthlyTokenLimit
                ));
                repository.markAlertSent(threshold);
                Log.warnf("Token budget alert: %.0f%% consumed (%d/%d tokens)",
                    ratio * 100, currentUsage, monthlyTokenLimit);
            }
        }
    }

    private String extractServiceName(ChatModelResponseContext context) {
        // Services should set a "service-name" attribute on their ChatModel request.
        // Example: chatModel.chat(ChatRequest.builder().messages(...).build(),
        //          Map.of("service-name", "order-service"))
        Object serviceName = context.attributes().get("service-name");
        return serviceName != null ? serviceName.toString() : "default";
    }
}
```

### 2. UsageRepository Interface

```java
public interface UsageRepository {
    void save(UsageRecord record);
    long getMonthlyTotal();
    long getMonthlyTotalForService(String service);
    boolean isAlertSent(double threshold);
    void markAlertSent(double threshold);
    TokenUsageSummary getSummary(String service, String period);
}
```

### 3. UsageRepository — In-Memory Implementation

```java
@ApplicationScoped
@IfBuildProperty(name = "token-budget.cost.persistence", stringValue = "memory")
public class InMemoryUsageRepository implements UsageRepository {

    private final ConcurrentHashMap<String, AtomicLong> monthlyUsage = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Double, Boolean> alertsSent = new ConcurrentHashMap<>();
    private final List<UsageRecord> records = Collections.synchronizedList(new ArrayList<>());

    @Override
    public void save(UsageRecord record) {
        records.add(record);
        monthlyUsage.computeIfAbsent(currentMonthKey(), k -> new AtomicLong())
            .addAndGet(record.totalTokens());
    }

    @Override
    public long getMonthlyTotal() {
        var counter = monthlyUsage.get(currentMonthKey());
        return counter != null ? counter.get() : 0;
    }

    @Override
    public boolean isAlertSent(double threshold) {
        return alertsSent.getOrDefault(threshold, false);
    }

    @Override
    public void markAlertSent(double threshold) {
        alertsSent.put(threshold, true);
    }

    @Scheduled(cron = "0 0 0 1 * ?") // Reset on 1st of each month
    void resetMonthly() {
        monthlyUsage.clear();
        alertsSent.clear();
    }

    private String currentMonthKey() {
        return YearMonth.now().toString();
    }
}
```

### 4. UsageRepository — Database Implementation

```java
@ApplicationScoped
@IfBuildProperty(name = "token-budget.cost.persistence", stringValue = "db")
public class DatabaseUsageRepository implements UsageRepository {

    // Delegates to a Panache entity mapped to the token_usage table.
    // Implement each method using Panache queries against TokenUsageEntity.
    // Example:
    //   public void save(UsageRecord record) {
    //       var entity = new TokenUsageEntity();
    //       entity.service = record.service();
    //       entity.inputTokens = record.inputTokens();
    //       entity.outputTokens = record.outputTokens();
    //       entity.recordedAt = record.recordedAt();
    //       entity.persist();
    //   }
    //
    //   public long getMonthlyTotal() {
    //       return TokenUsageEntity.find("recorded_at >= ?1",
    //           YearMonth.now().atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant())
    //           .project(Long.class).firstResult();
    //   }
    //
    // See Flyway migration below for the full schema.
}
```

### 5. REST Endpoints

```java
@Path("/api/tokens")
@ApplicationScoped
public class TokenUsageResource {

    @Inject UsageRepository repository;

    @ConfigProperty(name = "token-budget.cost.monthly-limit", defaultValue = "1000000")
    long monthlyTokenLimit;

    @GET
    @Path("/usage")
    public TokenUsageSummary getUsage(
            @QueryParam("service") String service,
            @QueryParam("period") @DefaultValue("current-month") String period) {
        return repository.getSummary(service, period);
    }

    @GET
    @Path("/budget")
    public TokenBudgetStatus getBudgetStatus() {
        long used = repository.getMonthlyTotal();
        return new TokenBudgetStatus(used, monthlyTokenLimit, (double) used / monthlyTokenLimit);
    }
}
```

### 6. Alert Event

```java
public record TokenBudgetAlert(
    String service,
    double threshold,
    long currentUsage,
    long limit
) {}

// Observer example — could send email, Slack, etc.
@ApplicationScoped
public class TokenBudgetAlertHandler {

    void onAlert(@Observes TokenBudgetAlert alert) {
        Log.warnf("TOKEN BUDGET ALERT [%s]: %.0f%% consumed (%d/%d)",
            alert.service(), alert.threshold() * 100,
            alert.currentUsage(), alert.limit());
    }
}
```

### 7. Flyway Migration (optional)

```sql
-- V1__create_token_usage_table.sql
CREATE TABLE token_usage (
    id          BIGSERIAL PRIMARY KEY,
    service     VARCHAR(255) NOT NULL,
    input_tokens  INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens  INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_usage_service ON token_usage(service);
CREATE INDEX idx_token_usage_recorded_at ON token_usage(recorded_at);

-- Monthly summary view
CREATE VIEW token_usage_monthly AS
SELECT
    service,
    DATE_TRUNC('month', recorded_at) AS month,
    SUM(input_tokens) AS total_input,
    SUM(output_tokens) AS total_output,
    SUM(input_tokens + output_tokens) AS total_tokens,
    COUNT(*) AS call_count
FROM token_usage
GROUP BY service, DATE_TRUNC('month', recorded_at);
```

### 8. Configuration

```properties
# Cost Budget
token-budget.cost.persistence=memory  # or "db"
token-budget.cost.monthly-limit=1000000
token-budget.cost.alert-thresholds=0.8,0.9,1.0

# Cost calculation (per 1M tokens, varies by provider)
token-budget.cost.input-price-per-million=3.00
token-budget.cost.output-price-per-million=15.00
```

### 9. Supporting Records

```java
public record UsageRecord(
    String service,
    int inputTokens,
    int outputTokens,
    Instant recordedAt
) {
    public int totalTokens() { return inputTokens + outputTokens; }
}

public record TokenUsageSummary(
    String service,
    String period,
    long totalInputTokens,
    long totalOutputTokens,
    long totalTokens,
    long callCount
) {}

public record TokenBudgetStatus(
    long tokensUsed,
    long tokensLimit,
    double usageRatio
) {}
```
