# Wiki Tagging Guidelines

Consistent tags are what make the wiki searchable. These guidelines ensure that the same concept always uses the same tag, regardless of who writes the entry or when.

## Core Rules

1. **Lowercase only**: `spring-boot`, not `Spring-Boot` or `SpringBoot`
2. **Kebab-case for multi-word tags**: `consumer-group`, not `consumerGroup` or `consumer_group`
3. **Singular, not plural**: `pattern`, not `patterns`; `recipe`, not `recipes`
4. **No spaces**: tags are single tokens — use kebab-case to connect words
5. **No version numbers in tags**: use `java`, not `java-21`. Version specifics go in the entry body.
6. **No generic noise tags**: avoid `misc`, `notes`, `todo`, `general`

## Tag Categories

Apply tags from multiple categories per entry to make it findable from different angles.

### Technology Tags
The specific technology the entry covers.

| Use | Avoid |
|-----|-------|
| `spring-boot` | `Spring Boot`, `springboot`, `spring` (too vague) |
| `quarkus` | `Quarkus` |
| `kafka` | `Apache Kafka`, `kafka-streams` (unless specifically about streams) |
| `keycloak` | `Keycloak`, `key-cloak` |
| `postgresql` | `postgres`, `PostgreSQL`, `psql` |
| `docker` | `Docker`, `container` (use as domain tag instead) |
| `kubernetes` | `k8s`, `Kubernetes` |
| `gradle` | `Gradle` |
| `maven` | `Maven` |
| `react` | `React`, `reactjs` |
| `typescript` | `TypeScript`, `ts` |
| `python` | `Python` |

### Domain / Problem Area Tags
What kind of problem or domain the entry addresses.

| Tag | When to use |
|-----|-------------|
| `authentication` | Login, identity verification |
| `authorization` | Permissions, access control, roles |
| `messaging` | Message queues, event streaming |
| `persistence` | Database access, ORM, repositories |
| `caching` | Cache strategies, Redis, in-memory |
| `performance` | Optimization, throughput, latency |
| `security` | Security hardening, vulnerabilities |
| `testing` | Test strategies, frameworks, patterns |
| `deployment` | CI/CD, release, infrastructure |
| `observability` | Logging, metrics, tracing |
| `api` | REST, GraphQL, API design |
| `configuration` | App config, environment variables |
| `migration` | Database migrations, schema changes |
| `debugging` | Troubleshooting, error analysis |

### Pattern / Type Tags
What kind of knowledge the entry contains.

| Tag | When to use |
|-----|-------------|
| `pattern` | Design or architectural pattern |
| `anti-pattern` | What to avoid and why |
| `recipe` | Step-by-step how-to |
| `decision` | ADR-style decision record |
| `concept` | Abstract idea or principle |
| `troubleshooting` | Problem + solution |
| `cheatsheet` | Quick reference |
| `workflow` | Process or sequence of steps |

## Tag Count Guidelines

| Entry type | Recommended tags |
|------------|-----------------|
| Concept | 2-4 tags (domain + pattern type) |
| Recipe | 3-5 tags (technology + domain + `recipe`) |
| Decision | 2-4 tags (technologies compared + domain) |
| Troubleshooting | 3-5 tags (technology + domain + `debugging`) |
| Tool | 2-3 tags (tool name + domain) |
| Reference | 2-4 tags (technology + `cheatsheet` or `reference`) |
| Journal | 2-3 tags (domain or project) |

## Examples

**Good tagging:**
```yaml
tags: [kafka, spring-boot, consumer-group, messaging, performance]
```

**Bad tagging:**
```yaml
tags: [Kafka, SpringBoot, consumerGroups, misc, java-programming]
```

**Corrected version:**
```yaml
tags: [kafka, spring-boot, consumer-group, messaging]
```

## When in Doubt

- Prefer the simpler, more widely-used term
- Check existing entries for how similar topics are tagged (run `/wiki-status` for a tag cloud)
- If you use a new tag, add it to this guide
- The `wiki-curator` skill will flag inconsistent tags during maintenance runs
