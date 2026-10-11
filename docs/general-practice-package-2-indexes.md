# General Practice Package 2 index foundation

Checkpoint 1 declares fields and indexes only. It does **not** enable General Practice sessions, submissions, or rate limiting. Do not deploy the modified models before reviewing index-creation behavior and approving the target-database rollout.

## Read-only preflight

`apps/Backend/scripts/preflightStandaloneQuizIndexes.js` is read-only and has no apply mode. It uses native MongoDB access rather than importing application models. It requires `MONGO_DB` with an explicit database path and `QUIZ_INDEX_EXPECTED_DB` matching that path exactly. In `NODE_ENV=production`, the database path must be `arunthai`. Do not put the URI in a repository file, log, or shell history.

The script reports the relevant collection/index definitions, duplicate active standalone session slots, duplicate attempt session references, legacy standalone records, stale slots, malformed rate-window records, and whether a replica-set/router session prerequisite is visible through `hello`. That check is not proof that every production transaction will succeed. Preflight does not normalize data, create collections, create or drop indexes, or run a transaction. `--apply` is rejected.

## Index definitions

- `quizsessions`: unique `{ quiz: 1, user: 1 }`, partial filter `{ contextType: "standalone", activeSlot: true }`, name `one_active_standalone_session`.
- `quizattempts`: unique `{ session: 1 }`, partial filter `{ session: { $type: "objectId" } }`, name `one_standalone_attempt_per_session`.
- `quizratewindows`: unique `{ user: 1, operation: 1, windowStart: 1 }`, name `one_quiz_rate_window`; TTL `{ expiresAt: 1 }`, `expireAfterSeconds: 0`, name `quiz_rate_window_expiry`.

Absent optional fields leave existing Video Course sessions and attempts outside the new partial indexes. An absent `runtimeFence` on a standalone Quiz is reported but is not by itself a preflight blocker at this checkpoint.

## Startup and rollout risk

`apps/Backend/config/dbConnection.js` currently calls `mongoose.connect(process.env.MONGO_DB)` without explicitly setting `autoIndex: false` or `autoCreate: false`. Consequently, loading models when this code is deployed may implicitly attempt collection/index creation according to Mongoose settings. **Do not treat a successful local test as evidence that production indexes are prepared.** Checkpoint 1 does not modify startup configuration.

Before enabling Package 2 runtime, obtain separate approval to inspect the exact testing database, resolve reported conflicts manually under an approved procedure, and create only the required additive indexes with an explicitly guarded tool. Verify their definitions after creation and confirm transaction capability. Do not run the existing broad `prepareQuizIndexes.js --apply` against populated collections: it is intentionally designed to stop on nonempty collections and includes broader operations. Production requires a separate reviewed preflight and approval. Never drop or rebuild existing indexes automatically as part of this foundation.

If a deployment occurs before the required unique indexes exist, application-only checks cannot guarantee cross-instance session or submission uniqueness. Keep Package 2 runtime disabled until index verification is complete. Rollback should disable that runtime while preserving all committed sessions, attempts, and indexes for review; it must not delete historical data.
