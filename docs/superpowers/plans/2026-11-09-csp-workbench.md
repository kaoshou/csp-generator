# CSP Workbench Implementation Plan

> Implement inline under the user's delegation. Use test-driven-development for policy behavior and verification-before-completion before delivery.

**Goal:** A complete Traditional Chinese CSP authoring and teaching workflow with reliable round trips.

**Architecture:** Static classic scripts share a pure policy engine with Node tests. Directive catalog supplies explanations and scenarios. DOM rendering treats imported content as text.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node 22+ built-in test runner and local server.

**Spec:** ../specs/2026-11-09-csp-workbench-design.md

## Global Constraints

- Preserve GPL-3.0, attribution and CNAME; no runtime dependencies or external requests.
- JSON preserves full project; raw CSP preserves unknown and empty directives.
- Single policy only; explicit errors on combined policies, unsafe control characters and malformed projects.
- Default Report-Only; explain limitations; no automated changes to the user's production website.

## Review Focus

1. Duplicate and unknown directives must not silently change policy semantics.
2. Empty enabled directives must differ from omitted directives.
3. Meta and server configuration escaping must not create invalid or unsafe snippets.
4. Invalid imports must leave current work intact.
5. Rule simulation must report uncertainty outside supported behavior.

### Task 1: Policy model, parsing, export, catalog

Files: scripts/catalog.js, scripts/core.js, tests/core.test.cjs, package.json.

Interfaces: parsePolicy(text) => {directives, mode, warnings}; serializePolicy(directives) => string; importProject(text) => project; exportProject(project) => string; validate(project) => issue[]; exportConfig(project, format) => string.

- [x] Write failing tests for round trips, header parsing, duplicate first-wins, empty directives, multiple policies, project schema and escaping.
- [x] Run `npm test`, verify missing implementation fails.
- [x] Implement catalog and engine; run complete suite green.

### Task 2: Guided configuration and simulation

Interfaces: createProject(scenarioId), effectiveDirective(directives, name), simulate(project, request), hashSource(text).

- [x] Write failing tests for independent scenario state, worker/element fallbacks, frame-ancestors independence, exact origins, wildcard apex, path and port boundaries, inline nonce and strict-dynamic uncertainty, Report-Only behavior.
- [x] Implement conservative simulation and SHA-256; run suite green.

### Task 3: Complete interface

Files: index.html, styles.css, scripts/app.js, scripts/serve.cjs.

- [x] Build accessible responsive editor, scenario confirmation, import preview, undo/redo, output, file export, local save, simulation, hash tool, rollout and lessons using core interfaces.
- [x] Start `npm run dev` and verify browser flows, desktop/mobile layout, import failures and navigation. File chooser automation limitation recorded in docs/verification.md.

### Task 4: Documentation and review

Files: README.md, docs/verification.md, .github/workflows/tests.yml, .gitignore.

- [x] Document deployment, reporting/nonce limitations, test and development commands, migration and data privacy.
- [x] Run `npm test`, syntax checks, diff whitespace checks and browser verification; fix observed defects.
- [x] Obtain independent whole-change review, address material findings and record evidence.
