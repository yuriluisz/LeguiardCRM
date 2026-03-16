# Performance Roadmap (Incremental)

## Phase 0 - Baseline

1. Establish clean Lighthouse baseline (3 runs median).
2. Track key metrics and smoke checks after each phase.

## Phase 1 - Backend/SQL

1. Reduce dashboard endpoint DB roundtrips.
2. Move derived counters to in-memory computation when safe.
3. Add and validate DB indexes.

## Phase 2 - Server-first dashboard render

1. Shift first dashboard data load to server components.
2. Keep only interaction-heavy UI in client components.

## Phase 3 - Bundle and hydration reduction

1. Analyze bundles (`next build --analyze`).
2. Lazy-load heavy chart modules and non-critical UI blocks.

## Phase 4 - Realtime optimization

1. Keep realtime subscriptions.
2. Coalesce updates and avoid full refetch storms.

## Phase 5 - Cache and delivery

1. Fine-tune cache headers for static assets.
2. Validate repeat-navigation and warm-cache behavior.

## Phase 6 - Technical hygiene

1. Fix `site.webmanifest` parse errors.
2. Fix robots configuration.
3. Remove console noise affecting diagnostics.

## Phase 7 - Guardrails

1. Add performance budget checks in CI.
2. Document regression playbook.
