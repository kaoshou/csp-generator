# Baseline and integrations implementation plan

**Goal:** Explain common scan checks and real integration changes, improve the professional UI, test and deploy the original site.

**Spec:** ../specs/2026-11-09-baseline-recipes-design.md

**Architecture:** Dependency-free scripts/guidance.js shares recipes and assessment functions with Node tests; app.js renders previews and commits existing version-1 projects. No schema migration required.

## Steps

- [x] Write failing tests for baseline content, additive recipes, fallback preservation, explicit empty lists, effective element directives, strict-dynamic conflict, URL safety, undo-compatible immutable proposals and assessment accuracy.
- [x] Implement scripts/guidance.js and baseline catalog entry; run full suite.
- [x] Build guidance work area, preview dialog, linked scanner/official guidance, professional visual polish and clear hash documentation.
- [x] Run Node checks and comprehensive local browser tests, including prior regression flows and responsive screens. Obtain independent review and address material issues.
- [ ] Update README and verification record; commit and push; create PR, verify CI, merge to main as explicitly authorized.
- [ ] Wait for GitHub Pages deployment, verify public assets and core browser flows, record URLs and commit.

## Review focus

Never loosen unrelated directives when adding a CDN. Never claim a host allowlist or Report-Only passes an external scanner. Preserve blank/none/fallback semantics and existing unknown directives. Do not fetch user-entered external URLs. Deploy only after tests, preserving current remote changes and domain.
