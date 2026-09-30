# Retention operations

Render Cron configuration is a later manual deployment step. Each normal job runs separately from `apps/Backend` and requires `RETENTION_JOBS_ENABLED=true`, `RETENTION_ALLOWED_DB_NAME` equal to the exact URI database name, and optionally `RETENTION_ALLOWED_MONGO_HOST` equal to the exact URI host.

## Normal scheduled jobs

`accounts:cleanup-assets`, `campaigns:cleanup-expired`, `payments:cleanup-proofs`, `payments:cleanup-retained-proofs`, `contacts:cleanup-suppressions`, `payments:minimize-snapshots`, `payment-methods:cleanup-qrs`, and `payments:cleanup-expired` are normal jobs. They fail closed before connecting when the guard is disabled or target validation fails.

## Offline / incident recovery

Commands with `--recover-stale-claims --writers-stopped`, or proof reconciliation with `--reconcile-staged --writers-stopped`, are never normal Cron Jobs. Stop all writers, verify the exact production target and backup state, then use the applicable recovery command.

## Dry run / preflight

`npm run payments:cleanup-expired -- --dry-run` requires exact database-target validation but not `RETENTION_JOBS_ENABLED=true`. It is read-only and reports payment IDs, status, createdAt, and reason codes only.

## Exit and alert semantics

`status: ok` means no actionable retryable failure. `status: preserved` or dry-run reasons are safe blockers and do not fail a run. `status: retryable_backlog` exits 2 and requires later retry/alerting. Configuration, connection, and uncaught process failures exit non-zero. Durable failed-proof/account-asset backlog already exits non-zero.

Phase 5B manual end-to-end cleanup UAT is deferred. Before the first production Payment retention cleanup, perform controlled operational verification of target, scheduler, monitoring, and backup/recovery procedures.
