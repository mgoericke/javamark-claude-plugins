---
name: review
description: Performs systematic code reviews focusing on BCE architecture, Quarkus conventions, security, and test coverage. Use this skill for code quality checks and before merge requests.
---

# Review Skill

## Purpose
Systematic code review based on defined quality criteria.

## Review Categories

### 1. Architecture (BCE)
- Correct separation: Boundary <-> Control <-> Entity
- No business logic in Boundary classes
- No direct DB access from Boundary

### 2. Quarkus Conventions
- RESTEasy Reactive (not Classic)
- CDI injection instead of manual instantiation
- Dev Services used where possible
- application.properties instead of YAML

### 3. Security
- Input validation at API boundaries
- No secrets in properties files (use ConfigSource)
- OIDC/Keycloak correctly configured
- SQL injection prevention (Panache queries)

### 4. AI Patterns (LangChain4j)
- @RegisterAiService correctly annotated
- Structured outputs with schema validation
- Appropriate temperature settings (0.3 for structured)
- Error feedback loop for LLM corrections

### 5. Tests
- @QuarkusTest for integration tests
- REST Assured for API tests
- Testcontainers for external services
- At least happy path + error case

## Output Format
Create a review summary with:
- Critical issues (blockers)
- Improvement suggestions
- Positive aspects
- Recommendations
