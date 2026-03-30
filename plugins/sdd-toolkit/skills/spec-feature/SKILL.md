---
name: spec-feature
description: Creates and maintains domain specifications following the SDD approach. Use this skill when specs need to be written, features derived, or domain requirements documented. Pure domain language — no technical details like frameworks, HTTP methods, or data types.
---

# Spec-Feature Skill

## Purpose
Create domain specifications in pure business language. Specifications describe *what* the system should do, never *how* it is technically implemented.

## Rules

### Strict Separation
- **IN the Spec**: Domain requirements, business rules, actors, processes, domain terms
- **NOT in the Spec**: Framework names, HTTP methods, data types, queue names, database schemas, package structures

### Structure of a Domain Spec
```markdown
# Feature: [Feature Name]

## Context
[Why is this feature needed?]

## Actors
[Who interacts with the feature?]

## Domain Requirements
[What should the system be able to do?]

## Business Rules
[What rules apply?]

## Acceptance Criteria
[When is the feature complete?]
```

### Anti-Patterns (FORBIDDEN in Specs)
- ❌ "The REST endpoint returns..."
- ❌ "The entity has the following fields: String name, Long id..."
- ❌ "Via RabbitMQ message..."
- ❌ "The Quarkus extension..."

### Correct Domain Formulations
- ✅ "The system allows the user to..."
- ✅ "Upon receiving a request, the system validates..."
- ✅ "The requester receives a confirmation..."

## Workflow
1. Analyze the user's requirement
2. Identify actors and business processes
3. Formulate purely domain-level requirements
4. Define business rules and acceptance criteria
5. Create the spec file under `specs/` in the project
