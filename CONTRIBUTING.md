# Contributing

How to build a plugin for this marketplace and get it listed.

## Workflow

1. Create a branch: `git checkout -b feat/my-plugin`
2. Create the plugin using the template
3. Update `marketplace.json`
4. Create a PR and get a review
5. After merge: users run `/plugin marketplace update`

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
javamark-claude-plugins/
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
│   ├── token-budget/
│   │   ├── skills/token-budget/
│   │   ├── commands/
│   │   └── references/          # Budget type implementations
│   ├── wiki-llm/
│   └── evolve/
├── _template/                    # Template for new plugins
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Plugin Anatomy

### plugin.json (Manifest)
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What does this plugin do?",
  "author": { "name": "Mark" }
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
