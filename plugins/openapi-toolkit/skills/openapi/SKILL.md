---
name: openapi
description: Generate and validate OpenAPI 3.x specifications from domain specs or existing Quarkus code. Use this skill for API design, API documentation, and contract-first development.
---

# OpenAPI Skill

## Purpose
Create OpenAPI 3.x specifications for Quarkus REST APIs, derived from domain specs or existing code.

## Conventions
- OpenAPI 3.0.3 or 3.1.0
- English descriptions for all APIs
- Schema definitions use `$ref` for reusability
- Example values for all request/response bodies
- Error responses following RFC 7807 (Problem Details)

## Workflow
1. Analyze the domain spec or existing code
2. Identify resources, operations, and data models
3. Create the OpenAPI specification as YAML
4. Validate against the OpenAPI schema specification
5. Generate example requests and responses
