# Performance Phase 0 - Baseline and Validation

This file defines how to measure performance before and after each phase.

## 1) Lighthouse baseline (clean environment)

Run in an Incognito window with all extensions disabled.

1. Open `https://crm.leguiard.com/dashboard`.
2. Run Lighthouse in mobile profile (navigation mode).
3. Repeat 3 times and record median values.

Track these metrics:

- `TTFB`
- `FCP`
- `Speed Index`
- `LCP` (when available)
- `Total Blocking Time`
- `Main-thread work`
- `Transferred JS`

## 2) Functional smoke checks

After each change, validate:

1. Login works.
2. Tenant selector works.
3. Dashboard cards and charts render expected values.
4. Kanban drag-and-drop still updates lead status.
5. Realtime updates still arrive.

## 3) Acceptance gates per phase

A phase can be considered done only if:

1. No functional regression in smoke checks.
2. Median `TTFB` and/or `Speed Index` improves.
3. No increase above 10% in JS payload or main-thread work.

## 4) Current target (Phase 1)

- Reduce `/api/dashboard` latency by lowering DB roundtrips.
- Apply missing indexes in `scripts/db/performance-indexes.sql`.
- Re-run Lighthouse and compare medians.
