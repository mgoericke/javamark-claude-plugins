# Wiki Frontmatter Schema

Every wiki entry must include the following YAML frontmatter block at the top of the file.

## Required Fields

```yaml
---
title: <string>
tags: [<tag>, ...]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
related: [<relative-path.md>, ...]
status: <draft | reviewed | evergreen>
---
```

## Field Definitions

### `title`
The human-readable title of the entry. Should be descriptive enough to understand the topic without reading the content.

- Use title case: `How to Configure Kafka Consumer Groups`
- Avoid vague titles: ~~`Kafka Notes`~~, ~~`Misc`~~

### `tags`
An array of lowercase, kebab-case strings. Tags are the primary search and discovery mechanism. Apply the [tagging guidelines](tagging-guidelines.md).

```yaml
tags: [kafka, spring-boot, consumer-groups, performance]
```

- Minimum: 2 tags per entry
- Maximum: 6 tags (if you need more, the entry may be too broad)
- Include: technology name, domain/problem area, pattern/type

### `created`
ISO 8601 date when the entry was first written. Never changes after initial creation.

```yaml
created: 2024-01-15
```

### `updated`
ISO 8601 date of the last meaningful update. Update this whenever the content changes. Claude Code uses this to detect stale entries (90+ days without update).

```yaml
updated: 2024-03-20
```

### `related`
Array of relative paths to other wiki entries that are meaningfully connected. Paths are relative to the wiki root.

```yaml
related:
  - concepts/event-driven-architecture.md
  - recipes/kafka-producer-setup.md
  - decisions/why-kafka-over-rabbitmq.md
```

- Empty on creation: `related: []`
- Populated by `/wiki-connect` or manually
- Links are bidirectional: if A lists B, B should also list A

### `status`
Lifecycle indicator for the entry:

| Value | Meaning |
|-------|---------|
| `draft` | Initial capture — may be incomplete, unverified, or rough |
| `reviewed` | Content has been verified and is considered accurate |
| `evergreen` | Actively maintained, regularly updated, high confidence |

Entries default to `draft`. Promote to `reviewed` after a quick review. Reserve `evergreen` for foundational entries you actively maintain.

## Example

```yaml
---
title: Configuring Kafka Consumer Groups in Spring Boot
tags: [kafka, spring-boot, consumer-groups, messaging]
created: 2024-01-15
updated: 2024-02-10
related:
  - concepts/event-driven-architecture.md
  - troubleshooting/kafka-consumer-lag.md
status: reviewed
---
```

## Validation

The `wiki-curator` skill checks for:
- Missing required fields
- Invalid `status` values
- `related` links pointing to non-existent files
- `updated` dates older than 90 days (stale signal)
- Tags not conforming to kebab-case lowercase convention
