---
name: java-scaffold
description: Generates Quarkus project scaffolds with BCE architecture (Boundary-Control-Entity), Panache entities, RESTEasy Reactive endpoints, and LangChain4j AI services. Use this skill when creating new modules, entities, or REST endpoints in Quarkus projects.
---

# Java Scaffold Skill

## Purpose
Generate runnable Quarkus project structures following the BCE pattern.

## Tech Stack
- **Quarkus** (current LTS), **Java 21** (Records, Pattern Matching, Sealed Classes)
- **RESTEasy Reactive** (not Classic)
- **Hibernate ORM with Panache** (Active Record or Repository)
- **Jackson** for JSON (`quarkus-rest-jackson`)
- **LangChain4j** via `quarkus-langchain4j-ollama` for AI services

## BCE Package Structure
```
src/main/java/de/example/module/
├── boundary/        # REST resources, WebSocket endpoints
├── control/         # Business services, AI services
├── entity/          # JPA entities, Records/DTOs, Value Objects
└── config/          # ConfigMappings, exception mappers
```

## Conventions
- Java Records for DTOs and API responses
- CDI (`@ApplicationScoped`, `@Inject`) instead of manual instantiation
- `@ConfigProperty` or `@ConfigMapping` for configuration
- `@ServerExceptionMapper` for error handling
- Logging via `@Inject Logger` or `Log.info()`

## Output
Generated code always includes:
1. All necessary imports
2. Matching `application.properties` configuration
3. Maven dependencies as a `<dependency>` block
4. Notes on required Dev Services or Ollama models

## AI Services
When the feature contains a LangChain4j AI service, ask once whether it needs a token budget:

| Budget | Protects | Adds |
|---|---|---|
| Context | Quality: what fits into the context window | A service and an estimator |
| Cost | Money: tokens per month, with alerts | Tracking, REST endpoints, a Flyway migration |
| Quota | Rate: requests and tokens per minute | Rate limiter, priority queue, Prometheus metrics |

If the answer is yes, follow the `token-budget` skill. If no, generate nothing for it.
