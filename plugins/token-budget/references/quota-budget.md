# Quota Budget Reference

## Overview

Quota budgets enforce rate limits on LLM token consumption — tokens per minute/hour per service. This prevents any single consumer from monopolizing the LLM and ensures fair access across services with different priority levels.

## Architecture

```
LLM Call Request
       │
       ▼
TokenRateLimiter (pre-flight check)
       │
       ├── Budget available? → proceed
       └── Budget exhausted? → queue / reject / wait
              │
              ▼
       PriorityQueue
       ├── Priority 1: Safety Gate (unlimited)
       ├── Priority 2: Agent Response (100k/h)
       └── Priority 3: Background Jobs (50k/h)
```

## Key Artifacts

### 1. TokenRateLimiter

Sliding window rate limiter for token consumption.

```java
@ApplicationScoped
public class TokenRateLimiter {

    @Inject TokenEstimator estimator;

    private final ConcurrentHashMap<String, SlidingWindow> windows = new ConcurrentHashMap<>();

    @ConfigProperty(name = "token-budget.quota.default-limit-per-hour", defaultValue = "100000")
    long defaultLimitPerHour;

    @ConfigProperty(name = "token-budget.quota.window-size-minutes", defaultValue = "60")
    int windowSizeMinutes;

    /**
     * Check if a request can proceed within the rate limit.
     * Returns a permit if budget is available, or a rejection with wait time.
     */
    public RateLimitResult tryAcquire(String service, int estimatedTokens) {
        var window = windows.computeIfAbsent(service,
            k -> new SlidingWindow(getLimitForService(k), windowSizeMinutes));

        return window.tryAcquire(estimatedTokens);
    }

    /**
     * Record actual token usage after the LLM call completes.
     * Called by the ChatModelListener.
     */
    public void recordUsage(String service, int actualTokens) {
        var window = windows.get(service);
        if (window != null) {
            window.record(actualTokens);
        }
    }

    public RateLimitStatus getStatus(String service) {
        var window = windows.get(service);
        if (window == null) return RateLimitStatus.unlimited();
        return window.getStatus();
    }

    private long getLimitForService(String service) {
        // Look up service-specific config, fall back to default
        return ConfigProvider.getConfig()
            .getOptionalValue("token-budget.quota." + service + ".limit-per-hour", Long.class)
            .orElse(defaultLimitPerHour);
    }
}
```

### 2. SlidingWindow

Thread-safe sliding window implementation.

```java
public class SlidingWindow {

    private final long limitPerWindow;
    private final int windowMinutes;
    private final ConcurrentLinkedDeque<TokenRecord> records = new ConcurrentLinkedDeque<>();
    private final AtomicLong currentTotal = new AtomicLong(0);

    public SlidingWindow(long limitPerWindow, int windowMinutes) {
        this.limitPerWindow = limitPerWindow;
        this.windowMinutes = windowMinutes;
    }

    /**
     * Check if a request fits within the current window budget.
     * Note: This is an optimistic check — it does not reserve tokens.
     * Call record() after the LLM call completes with actual token counts.
     * Under high concurrency, the actual usage may briefly exceed the limit.
     */
    public RateLimitResult tryAcquire(int estimatedTokens) {
        evictExpired();
        long current = currentTotal.get();

        if (current + estimatedTokens <= limitPerWindow) {
            return RateLimitResult.permitted(current, limitPerWindow);
        }

        // Calculate when enough budget will free up
        Duration waitTime = estimateWaitTime(estimatedTokens);
        return RateLimitResult.rejected(current, limitPerWindow, waitTime);
    }

    public void record(int tokens) {
        records.addLast(new TokenRecord(Instant.now(), tokens));
        currentTotal.addAndGet(tokens);
    }

    public RateLimitStatus getStatus() {
        evictExpired();
        long used = currentTotal.get();
        return new RateLimitStatus(used, limitPerWindow, limitPerWindow - used);
    }

    private void evictExpired() {
        Instant cutoff = Instant.now().minus(windowMinutes, ChronoUnit.MINUTES);
        TokenRecord oldest;
        while ((oldest = records.peekFirst()) != null && oldest.timestamp().isBefore(cutoff)) {
            records.pollFirst();
            currentTotal.addAndGet(-oldest.tokens());
        }
    }

    private Duration estimateWaitTime(int neededTokens) {
        long mustFree = currentTotal.get() + neededTokens - limitPerWindow;
        long freed = 0;
        for (var record : records) {
            freed += record.tokens();
            if (freed >= mustFree) {
                return Duration.between(Instant.now(),
                    record.timestamp().plus(windowMinutes, ChronoUnit.MINUTES));
            }
        }
        return Duration.ofMinutes(windowMinutes);
    }

    private record TokenRecord(Instant timestamp, int tokens) {}
}
```

### 3. Priority Queue for LLM Calls

```java
@ApplicationScoped
public class PriorityLlmScheduler {

    @Inject TokenRateLimiter rateLimiter;

    public enum Priority {
        SAFETY_GATE(1),    // Always allowed, no rate limit
        AGENT_RESPONSE(2), // User-facing, high priority
        BACKGROUND_JOB(3); // Batch processing, can wait

        final int level;
        Priority(int level) { this.level = level; }
    }

    /**
     * Acquire permission to make an LLM call.
     * Safety gate calls bypass rate limiting entirely.
     */
    public CompletionStage<RateLimitPermit> acquire(String service, int estimatedTokens, Priority priority) {
        if (priority == Priority.SAFETY_GATE) {
            return CompletableFuture.completedFuture(RateLimitPermit.unlimited());
        }

        var result = rateLimiter.tryAcquire(service, estimatedTokens);
        if (result.permitted()) {
            return CompletableFuture.completedFuture(RateLimitPermit.granted());
        }

        // Queue the request and retry after the suggested wait time.
        // Uses Mutiny to avoid blocking a thread from the pool.
        return Uni.createFrom().item(RateLimitPermit.granted())
            .onItem().delayIt().by(result.retryAfter())
            .subscribeAsCompletionStage();
    }
}
```

### 4. Prometheus Metrics

```java
@ApplicationScoped
public class TokenQuotaMetrics {

    @Inject MeterRegistry registry;

    private final ConcurrentHashMap<String, Counter> tokenCounters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Counter> rejectionCounters = new ConcurrentHashMap<>();

    public void recordTokens(String service, int tokens) {
        tokenCounters.computeIfAbsent(service, s ->
            Counter.builder("llm.tokens.consumed")
                .tag("service", s)
                .register(registry)
        ).increment(tokens);
    }

    public void recordRejection(String service) {
        rejectionCounters.computeIfAbsent(service, s ->
            Counter.builder("llm.ratelimit.rejected")
                .tag("service", s)
                .register(registry)
        ).increment();
    }

    // Gauge for current window usage (registered once per service)
    public void registerWindowGauge(String service, Supplier<Number> usageSupplier) {
        Gauge.builder("llm.tokens.window.usage", usageSupplier)
            .tag("service", service)
            .register(registry);
    }
}
```

### 5. Configuration

```properties
# Quota Budget — Global defaults
token-budget.quota.default-limit-per-hour=100000
token-budget.quota.window-size-minutes=60

# Per-service overrides
token-budget.quota.safety-gate.limit-per-hour=0  # 0 = unlimited
token-budget.quota.agent-response.limit-per-hour=100000
token-budget.quota.background-jobs.limit-per-hour=50000
```

### 6. Supporting Records

```java
public record RateLimitResult(
    boolean permitted,
    long currentUsage,
    long limit,
    Duration retryAfter
) {
    public static RateLimitResult permitted(long current, long limit) {
        return new RateLimitResult(true, current, limit, Duration.ZERO);
    }
    public static RateLimitResult rejected(long current, long limit, Duration retryAfter) {
        return new RateLimitResult(false, current, limit, retryAfter);
    }
}

public record RateLimitStatus(long tokensUsed, long tokenLimit, long tokensRemaining) {
    public static RateLimitStatus unlimited() {
        return new RateLimitStatus(0, Long.MAX_VALUE, Long.MAX_VALUE);
    }
}

public record RateLimitPermit(boolean granted, boolean unlimited) {
    public static RateLimitPermit granted() { return new RateLimitPermit(true, false); }
    public static RateLimitPermit unlimited() { return new RateLimitPermit(true, true); }
}
```

### 7. Grafana Dashboard Queries

Useful PromQL queries for a Grafana dashboard:

```promql
# Tokens consumed per hour by service
rate(llm_tokens_consumed_total[1h])

# Rate limit rejections per minute
rate(llm_ratelimit_rejected_total[5m])

# Current window usage percentage
llm_tokens_window_usage / token_budget_quota_limit * 100
```
