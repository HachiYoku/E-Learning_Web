# Manual payment integrity

Payment submission and review now require MongoDB multi-document transactions
(replica set or sharded deployment). There is no standalone/non-atomic fallback.
This does not require Redis or another backend instance. A local development
MongoDB must be configured as a replica set. Tests start their own isolated
one-member replica set; use an appropriately redundant production deployment.

## State transitions

- Submission: proof uploaded outside the transaction; inside one transaction,
  revalidate purchase/promo, reserve capacity, insert an active redemption with
  its preallocated payment ID, insert pending Payment, remove staged cleanup
  record. All database changes commit or none do.
- Approval: conditional pending → approved and enrollment upsert commit together.
  Failure leaves the payment pending and creates no enrollment.
- Rejection: conditional pending → rejected, active redemption → released
  (active: false, release timestamp/reason), and capacity decrement commit
  together. Financial snapshots and redemption rows are retained.
- A second review gets HTTP 409. There is no second terminal transition or
  capacity decrement. Approved redemptions remain active/consumed.
- Payment and promo operations write the same promo document in the transaction
  before checking history. Concurrent first use and mutation serialize through
  MongoDB write conflicts/retries. Used offers are archived, not deleted.
- Notifications, emails, Socket.IO signals and audit delivery run after commit
  and cannot roll back money/access state. Delivery is best effort; this change
  does not introduce a notification outbox or guaranteed delivery.

## Deploy in a maintenance window

1. Back up the database. Verify transaction-capable topology. Do not assume the
   currently configured URI is a replica set just because the backend is single
   instance.
2. Stop all old backend writers before migrating. Do not mix old/new versions:
   old code deletes redemptions and does not join the transaction boundary.
3. From apps/Backend run `npm run payments:migrate-integrity` for a read-only
   inspection, then `npm run payments:migrate-integrity -- --apply`.
4. The migration associates retained redemptions with persisted payments, marks
   rejected attempts released, backfills active records, recomputes capacity,
   creates the partial unique active-promo/user index, then drops only the old
   lifetime-unique promo/user index. It is repeatable. Unassociated/inconsistent
   redemption records stop the migration for operator review.
5. Review the reported legacy approved payments without enrollment. The
   migration does not infer authorization to grant historical course access.
   Previously deleted redemptions cannot be truthfully reconstructed; their
   payment snapshots remain untouched and the report counts missing evidence.
6. Deploy the new backend. Verify new submission, rejection/reuse and approval
   in staging first. No new environment keys are required; MONGO_DB must point
   to a transaction-capable deployment. Routes fail closed with HTTP 503 if
   topology or redemption migration is not ready.

The operational scripts require an explicit database guard. In production
(`NODE_ENV=production`) they permit only `arunthai`; a different
`PAYMENT_INTEGRITY_EXPECTED_DB` value fails closed. In development/test, set
`PAYMENT_INTEGRITY_EXPECTED_DB` to the exact intended database, for example
`english_kafe`. This guard applies to both migration and reconciliation scripts
and does not change the application's runtime database connection.

Rollback to the old application after new released records exist is unsafe
without a separate data/index rollback plan.

## Proof cleanup and recovery

Cloudinary cannot participate in a MongoDB transaction. A cleanup row and known
unique public ID are persisted before upload; payment commit removes the row
atomically. A definite submission failure attempts immediate deletion. Storage
or DB outages leave a durable row for recovery.

Run `npm run payments:cleanup-proofs` to retry known failed uploads (state
cleanup). This can run while the app is online; it never deletes an asset
referenced by a payment. Schedule/monitor this command operationally; a failed
cleanup is not silently treated as completed.

A process crash or unknown commit outcome may leave staged/uncertain rows.
Do not automatically delete them while requests may still be running. Stop
backend writers, let in-flight Cloudinary requests and MongoDB transactions
settle, restore database connectivity, then run:

`npm run payments:cleanup-proofs -- --reconcile-staged --writers-stopped`

Recovery reads committed payment references from the primary with majority
read concern. Attached assets are retained; only unreferenced staged assets
are removed. This manual recovery requirement avoids destroying a receipt on
an ambiguous commit. Proofs orphaned by the old implementation are not
automatically discoverable from these new cleanup records.

## Verification

`npm run test:payment-integrity` uses real Express payment/promo routes, JWT
authorization, MongoDB replica-set transactions and indexes. Only external
Cloudinary/email delivery is simulated. Injected failures exercise the real
controller path, including after database writes inside the transaction.

Existing auth, promo and realtime suites also start isolated replica sets.
