# Manual retention operations runbook

## Current launch infrastructure

- Render: Free plan
- MongoDB Atlas: Free cluster
- Retention execution: Manual
- Automated scheduled cleanup: Not currently enabled

The retention workers and production safety guard are implemented, but no Render Cron Job is enabled at launch. A designated operator runs normal workers manually when required. This does not change any retention deadline or business rule.

Recovery commands are incident procedures, not normal maintenance. They must never be substituted for a retry simply because a normal worker reports a backlog.

## Preconditions and guard

Every normal worker requires the following environment configuration before it connects to MongoDB:

| Variable | Requirement |
| --- | --- |
| `MONGO_DB` | A MongoDB URI with one exact database name. Do not put credentials in maintenance notes or command history. |
| `RETENTION_ALLOWED_DB_NAME` | Exactly the database name in `MONGO_DB`. |
| `RETENTION_ALLOWED_MONGO_HOST` | Optional; when set, exactly the host in `MONGO_DB`. |
| `RETENTION_JOBS_ENABLED` | Must be exactly `true` for a destructive worker. |

The guard fails closed before a worker connects when the URI is absent or malformed, the database name does not match, the optional host does not match, or destructive execution has not been enabled. Never bypass or weaken this guard. `--dry-run` for final Payment retention still requires exact URI/database (and optional host) validation, but does not require `RETENTION_JOBS_ENABLED=true`.

Before every manual session, use the deployment’s approved secret/configuration interface to verify the effective target. Confirm the exact database name and host visually; do not rely on a similarly named environment. The repository does not establish whether a particular Render Free-plan console/shell workflow is available, so choose an approved, access-controlled one-off execution method before operating.

## Normal manual procedure

Run commands from `apps/Backend`, against the approved production deployment configuration and current intended commit.

1. Confirm the effective `MONGO_DB` host and database, and confirm it matches `RETENTION_ALLOWED_DB_NAME` and, when used, `RETENTION_ALLOWED_MONGO_HOST`.
2. Confirm the deployed code/commit contains the intended retention implementation. Do not run a worker from an unreviewed local checkout.
3. Review the available backup and recovery capability before considering destructive work. Do not assume Atlas managed backup or point-in-time recovery is available on the launch cluster unless it has been verified separately.
4. Review the relevant durable-work backlog and active holds/claims in the application’s approved operational view or read-only database process. Understand blockers before running a worker.
5. For final Payment deletion, run the read-only preflight first:

   ```sh
   npm run payments:cleanup-expired -- --dry-run
   ```

   This emits candidate IDs, status, `createdAt`, and an eligibility/blocker reason; it does not delete or modify data. Use it before the first real seven-year Payment cleanup and whenever that cleanup is being considered later.
6. Set or verify the required guard variables, including `RETENTION_JOBS_ENABLED=true`, only for the controlled destructive execution. Never replace guard checks with flags or code changes.
7. Run **one** normal worker from the table below.
8. Inspect its structured output and process exit status before doing anything else.
9. Verify the expected database and, where applicable, Cloudinary asset result through the approved operational process. Do not create artificial expired production records for testing.
10. Record the date/time, operator, deployed commit, confirmed target, command, output summary, exit status, expected effects, and any follow-up work.
11. Only then consider another worker. A result from one worker must be understood before a different worker is run.

## Normal retention workers

| npm command | Purpose | Practical manual cadence |
| --- | --- | --- |
| `npm run accounts:cleanup-assets` | Retries durable cleanup of student account assets that could not be removed immediately after a committed deletion/replacement. | Monthly; additionally after a known asset-cleanup failure. |
| `npm run campaigns:cleanup-expired` | Processes expired campaigns and their owned campaign images through durable cleanup. | Monthly. |
| `npm run payments:cleanup-proofs` | Cleans durable work for failed/uncommitted payment-proof submissions after revalidating current Payment references. | Monthly; additionally after a known proof-upload failure. |
| `npm run payments:cleanup-retained-proofs` | Removes eligible retained payment proofs after their approved retention deadline, subject to holds and claims. | Monthly. |
| `npm run contacts:cleanup-suppressions` | Minimizes/deletes eligible unsubscribed ContactLeads while preserving leads linked to enquiries. | Quarterly. |
| `npm run payments:minimize-snapshots` | Removes eligible detailed PaymentMethod snapshot fields after the approved minimization deadline, subject to holds and claims. | Monthly or quarterly. |
| `npm run payment-methods:cleanup-qrs` | Retries durable cleanup of unreferenced PaymentMethod-owned QR assets. | Monthly; additionally after QR replacement/deactivation work. |
| `npm run payments:cleanup-expired` | Performs final seven-calendar-year deletion of eligible terminal Payments and associated safe relationships. | Quarterly, after dry-run and review. |

These frequencies are operational guidance only. They do not shorten the approved deadlines: workers independently revalidate retention eligibility. A monthly maintenance session normally covers short-lived asset/proof work and applicable campaign/snapshot work; perform the contact and final-Payment checks in the indicated quarterly session. This avoids daily manual operation of eight commands.

### Result and exit handling

Where a worker prints `status`, interpret it as follows:

| Result | Meaning | Operator action |
| --- | --- | --- |
| `ok` | The worker completed without a reported retryable failure. It may have processed zero records. | Record and continue only after reviewing the output. |
| `preserved` | A safety condition deliberately kept one or more records unchanged. | Record the blocker; do not force deletion. Re-run normally later if appropriate. |
| `retryable_backlog` | A retryable cleanup failure remains; the worker exits `2`. | Investigate the cause and retry via the normal worker according to its normal semantics. Do **not** jump to stale-claim recovery. |
| configuration, connection, or hard failure | Guard/configuration errors and uncaught failures exit non-zero (normally `1`). | Stop. Correct configuration/connectivity or investigate before another run. |

`accounts:cleanup-assets` and `payments:cleanup-proofs` currently print remaining durable-work counts rather than a `status` field and exit non-zero while work remains. Treat a non-zero result from either as a backlog requiring review/retry, not as permission to use recovery.

## Offline / incident recovery only

> **NEVER run writers-stopped recovery while the Backend or another writer can still modify the affected data.**

Recovery is appropriate only after an incident leaves a claim/worker state stranded, all relevant backend writers have been stopped, in-flight work is allowed to finish, the exact guarded production target and available backup/recovery situation have been reviewed, and the operator has recorded why normal retry is unsafe or insufficient. These commands remain destructive and require the same production guard variables.

Invoke the relevant worker with its recovery flags only when the incident preconditions above are met, using these exact current forms:

```sh
npm run campaigns:cleanup-expired -- --recover-stale-claims --writers-stopped
npm run payments:cleanup-proofs -- --reconcile-staged --writers-stopped
npm run payments:cleanup-retained-proofs -- --recover-stale-claims --writers-stopped
npm run contacts:cleanup-suppressions -- --recover-stale-claims --writers-stopped
npm run payments:minimize-snapshots -- --recover-stale-claims --writers-stopped
npm run payment-methods:cleanup-qrs -- --recover-stale-claims --writers-stopped
npm run payments:cleanup-expired -- --recover-stale-claims --writers-stopped
```

- Campaign recovery considers only expired, claimed Campaigns. It finalizes an eligible no-image Campaign or restores the durable image-cleanup path.
- Failed-proof reconciliation examines staged durable proof cleanup records only after writers are stopped; it revalidates whether a Payment currently owns the proof.
- Retained-proof, ContactLead, snapshot, QR, and final-Payment recovery release/requeue only the corresponding stale claim state under their implemented safety checks. QR recovery itself does not delete from Cloudinary.
- There is no offline recovery flag for `accounts:cleanup-assets`; retry that normal durable worker after investigating its backlog.

Do not configure any of these flags as a Render cron command or routine calendar task.

## Backup and recovery review

Before a destructive session, determine what is actually available for the target cluster:

- **Creating a backup** is a separate, intentional operation, for example an approved export process such as `mongodump` when available. It is not performed by any retention worker.
- **Verifying a backup** means confirming a recent backup exists, is protected, covers the intended database, and has a viable restore procedure. A backup that has not been located or tested must not be assumed usable.
- **Restoring** is a separate recovery operation, potentially destructive to a target database, and must not be combined with a retention run. It requires an approved incident plan.
- **Retention execution** is the guarded worker command itself. It does not create, verify, or restore backups.

This project does not verify Atlas managed backup/PITR availability. At launch, review the actual Atlas plan and any approved backup/export capability before destructive maintenance; do not state that managed recovery exists until it has been independently confirmed.

## Deferred Phase 5B first-run requirement

Manual destructive Phase 5B UAT was deferred. Therefore the first production Payment-retention execution requires especially careful dry-run/preflight and operator review. Do not create fake or expired production Payments to test it. Use the read-only dry run, verify the target and deployed commit, review backup/recovery capability, inspect every candidate/blocker, and record the outcome before deciding whether to run the normal final-Payment worker.

## Privacy and legal audit handoff: implemented facts

- `ContactEnquiry` records have a MongoDB TTL index of 365 days from `submittedAt`.
- Unsubscribed ContactLeads without an enquiry are minimized after withdrawal and deleted after three calendar years from withdrawal; leads with enquiries are preserved by the cleanup worker.
- Terminal Payments are eligible for final cleanup seven calendar years from `createdAt`, subject to holds, claims, proof-cleanup work, and relationship revalidation.
- Approved/rejected payment proofs are eligible for cleanup 12 calendar months after `reviewedAt`, unless a proof-retention hold or safety dependency blocks it.
- Detailed PaymentMethod snapshot fields are eligible for minimization 12 calendar months after `reviewedAt` for approved/rejected Payments, subject to holds and claims.
- Campaigns have a 12-calendar-month lifecycle and are deleted through a durable image-cleanup path where needed.
- AuditLog entries receive a six- or 12-calendar-month expiry according to the centralized action classification and are removed by their TTL index.
- Student account deletion removes private learning-account data, preserves financial/payment history outside that transaction, creates a minimized deletion audit event, and durably queues a current owned avatar for cleanup when applicable.
- At launch, production retention execution is manual rather than automatically scheduled.

These are implementation facts for the forthcoming Privacy & Legal Audit, not a Privacy Policy and not legal advice.

## Future scaling

When traffic/operational requirements justify infrastructure upgrades:

- introduce scheduled retention workers;
- review Render service sizing;
- review Atlas cluster sizing;
- enable appropriate managed backup/recovery capabilities;
- introduce monitoring/alerting;
- review least-privilege database/service credentials; and
- preserve the existing retention policies and cleanup architecture.

These are future options, not current launch requirements. They should automate the existing workers without changing approved retention policy.
