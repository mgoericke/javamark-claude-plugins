# Compass interview

Used by `/evolve start`. Ask in short rounds, never as one wall of questions. Detect what you can from the repository
(README, CLAUDE.md, `package.json`, `pom.xml`, `build.gradle*`, routes, OpenAPI file) and ask only for the rest. Say what you detected and let the user correct it.

The compass matters most. In the Rasen-Radar lab the product rules arrived mid-run and rounds drifted until they did. Get them before round 1.

## 1. Target

- What is this application and who uses it?
- Build command, test command, start command (with `{port}` or the `PORT` variable), optional setup command (e.g. `npm ci`), base URL.
  `init.mjs` detects npm, Maven, Gradle and static sites and writes them into `.evolve/evolve.json`; confirm or fix them.
- Kind: `web` (has a UI) or `backend` (HTTP service). Backends need endpoints in `evolve.json` as `{path, status}`.
- Routes to walk (default `["/"]`). Ask for the important ones.
- Anything that must not be touched (databases, paid APIs, generated folders)?

## 2. Mode

- `invent` (default): each round one new bold idea.
- `modernize`: behaviour must not change. Ask for the target stack (e.g. "Tomcat WAR to Quarkus, cloud-ready").

## 3. Size

- Rounds per block and number of blocks (e.g. 3 x 5). evolve stops after each block. Defaults: 5 rounds, 3 blocks.

## 4. Compass (invent mode; for modernize ask for the no-gos only)

Write the answers as short, checkable rules in `.evolve/COMPASS.md`, in the user's language. Each rule must be something an idea can be tested against.

- **Product principles**: 3 to 6 rules ("data first", "AI one click away", "newest first").
- **No-gos**: things that must never appear (a language, a feature class, a tone). Example: no betting language.
- **Audience**: who it is for and what they come to do.
- **Existing strengths**: what already works and must not get worse.
- **Data rules**: which data is real; invented data, testimonials and user numbers are always out.

## COMPASS.md shape

```
# Compass

## Principles
- ...
## No-gos
- ...
## Audience
- ...
## Keep
- ...
```

Read the compass back to the user and get a yes before continuing. Later changes happen only through "change compass" at the end of a block.
