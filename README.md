# Personal Skills Marketplace

Plugin marketplace for Claude Code — hosted on GitHub, installable via the `/plugin` command.

## Quick Start

### Set up the marketplace in Claude Code (one-time)

```bash
# Via HTTPS (with GitHub PAT)
/plugin marketplace add https://github.com/mgoericke/javamark-claude-skills.git

# Via SSH
/plugin marketplace add git@github.com:mgoericke/javamark-claude-skills.git
```

> **Prerequisite**: `git clone` must work for the repository (SSH key or PAT configured).

### Install plugins

```bash
# Open the plugin manager and browse
/plugin

# Or install directly
/plugin install sdd-toolkit@javamark-claude-skills
/plugin install java-scaffold@javamark-claude-skills
/plugin install review-toolkit@javamark-claude-skills
```

### Use plugins

After installation, slash commands and skills are automatically available:

```bash
/coworker                  # Start coworker mode (from sdd-toolkit)
/scaffold UserProfile      # Generate a Quarkus feature (from java-scaffold)
```

Skills are automatically activated when they match the current task.

## Available Plugins

| Plugin | Description | Skills | Commands |
|--------|-------------|--------|----------|
| **sdd-toolkit** | Spec-Driven Development | spec-feature, coworker | /coworker, /spec |
| **java-scaffold** | Quarkus/BCE project scaffolding | java-scaffold | /scaffold |
| **openapi-toolkit** | OpenAPI specifications | openapi | — |
| **review-toolkit** | Code reviews | review | /review |
| **doc-toolkit** | Documentation & blog posts | doc, blog-post | /blog, /adr |
| **frontend-toolkit** | TailAdmin/Alpine.js UIs | frontend | /prototype |
| **infografik** | Data visualization | infografik | /infografik |
| **token-budget** | LLM token budget management | token-budget | /token-budget |

## Create a New Plugin

1. **Copy the template:**
   ```bash
   cp -r _template plugins/my-new-plugin
   ```

2. **Configure the plugin:**
   - Edit `plugins/my-new-plugin/.claude-plugin/plugin.json`
   - Create skills under `skills/` (each skill needs a `SKILL.md`)
   - Optional: commands under `commands/`, agents under `agents/`

3. **Register in the marketplace:**
   - Add an entry to the `plugins` array in `.claude-plugin/marketplace.json`

4. **Validate and push:**
   ```bash
   # Optional: Validate locally
   claude plugin validate .

   # Push to GitHub
   git add -A && git commit -m "feat: new plugin my-new-plugin" && git push
   ```

5. **Update for users:**
   ```bash
   /plugin marketplace update
   ```

## Directory Structure

```
javamark-claude-skills/
├── .claude-plugin/
│   └── marketplace.json          # Plugin registry
├── plugins/
│   ├── sdd-toolkit/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # Plugin manifest
│   │   ├── skills/
│   │   │   ├── spec-feature/
│   │   │   │   └── SKILL.md      # Skill instructions
│   │   │   └── coworker/
│   │   │       └── SKILL.md
│   │   └── commands/
│   │       └── coworker.md       # /coworker slash command
│   ├── java-scaffold/
│   ├── openapi-toolkit/
│   ├── review-toolkit/
│   │   ├── skills/review/
│   │   └── agents/               # Specialized sub-agents
│   ├── doc-toolkit/
│   ├── frontend-toolkit/
│   ├── infografik/
│   └── token-budget/
│       ├── skills/token-budget/
│       ├── commands/
│       └── references/          # Budget type implementations
├── _template/                    # Template for new plugins
└── README.md
```

## Plugin Anatomy

### plugin.json (Manifest)
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What does this plugin do?",
  "author": { "name": "Mark" },
  "components": {
    "skills": ["skills/"],
    "commands": ["commands/"],
    "agents": ["agents/"]
  }
}
```

### SKILL.md (Skill Definition)
```markdown
---
name: skill-name
description: When should this skill be activated?
---

# Skill Name

## Purpose
[What does the skill do?]

## Instructions
[How should Claude proceed?]
```

### Slash Command (.md file in commands/)
```markdown
---
description: Brief description
---

# /command-name

Instructions for Claude when /command-name is invoked.
Arguments are available as: $ARGUMENTS
```

## Versioning

- Maintain plugin versions in `plugin.json` (Semver)
- On updates: bump version -> Git push -> users run `/plugin marketplace update`
- Claude Code caches plugins locally under `~/.claude/plugins/cache/`

## Pre-configuration

Plugins can be pre-configured in Claude Code settings:

```json
// .claude/settings.json (project or user level)
{
  "extraKnownMarketplaces": {
    "javamark-claude-skills": {
      "source": {
        "source": "url",
        "url": "https://github.com/mgoericke/javamark-claude-skills.git"
      }
    }
  },
  "enabledPlugins": {
    "sdd-toolkit@javamark-claude-skills": true,
    "java-scaffold@javamark-claude-skills": true
  }
}
```

## Contributing

1. Create a branch: `git checkout -b feat/my-plugin`
2. Create the plugin using the template
3. Update `marketplace.json`
4. Create a PR and get a review
5. After merge: users run `/plugin marketplace update`
