# General Practice Package 2 index foundation

The General Practice API is integrated, but its runtime is disabled by default. Index preparation and activation are separate, owner-approved operations. Creating this local preparation tool does **not** authorize using `--apply` against Atlas.

## Read-only preflight

`apps/Backend/scripts/preflightStandaloneQuizIndexes.js` is read-only and has no apply mode. It uses native MongoDB access rather than importing application models. It requires `MONGO_DB` with an explicit database path and `QUIZ_INDEX_EXPECTED_DB` matching that path exactly. In `NODE_ENV=production`, the database path must be `arunthai`. Do not put the URI in a repository file, log, or shell history.

The script reports the relevant collection/index definitions, duplicate active standalone session slots, duplicate attempt session references, legacy standalone records, stale slots, malformed rate-window records, and whether a replica-set/router session prerequisite is visible through `hello`. That check is not proof that every production transaction will succeed. Preflight does not normalize data, create collections, create or drop indexes, or run a transaction. `--apply` is rejected.

`prepareStandaloneQuizIndexes.js` has a second, read-only default inspection. It requires `--expected-db NAME` and an ephemeral `MONGO_DB` URI whose database path matches that name. Without `--apply`, it never creates indexes or collections. It compares all six runtime-required specifications and reports missing, existing, conflicting, duplicate-key, malformed, and legacy records. It rejects the known production database `arunthai` and refuses to run with `NODE_ENV=production`. Review the exact target and report before requesting separate approval for a testing-database apply. Never paste a URI into a ticket or agent conversation.

From `apps/Backend`, the read-only command shape is `node scripts/prepareStandaloneQuizIndexes.js --expected-db TEST_DATABASE_NAME`. Supply `MONGO_DB` only to that process through a secure local mechanism; do not put its value in shell history or repository files. The future apply command adds `--apply` to that invocation and requires separate owner approval. The tool checks the URI database path before connecting and checks the connected database name again before inspecting or creating an index. It cannot itself prove that an Atlas hostname belongs to the isolated testing cluster, so the operator must verify that independently.

## Index definitions

- `quizsessions`: TTL `{ expiresAt: 1 }`, `expireAfterSeconds: 0`, name `expiresAt_1`; unique `{ quiz: 1, user: 1 }`, partial filter `{ contextType: "standalone", activeSlot: true }`, name `one_active_standalone_session`.
- `quizattempts`: unique `{ quiz: 1, user: 1, attemptNumber: 1 }`, partial filter `{ attemptNumber: { $exists: true } }`, name `quiz_1_user_1_attemptNumber_1`; unique `{ session: 1 }`, partial filter `{ session: { $type: "objectId" } }`, name `one_standalone_attempt_per_session`.
- `quizratewindows`: unique `{ user: 1, operation: 1, windowStart: 1 }`, name `one_quiz_rate_window`; TTL `{ expiresAt: 1 }`, `expireAfterSeconds: 0`, name `quiz_rate_window_expiry`.

Absent optional fields leave existing Video Course sessions and attempts outside the new partial indexes. An absent `runtimeFence` on a standalone Quiz is reported but is not by itself a preflight blocker at this checkpoint.

## Startup and rollout risk

`apps/Backend/config/dbConnection.js` explicitly sets `autoIndex: false` and `autoCreate: false`. Loading application models must not prepare indexes or collections. **Do not treat a successful local test as evidence that Atlas indexes are prepared.**

For a future testing rollout, first verify the isolated target database and take an appropriate backup. With separate approval, run the read-only standalone preflight and the new tool's read-only inspection; review every conflicting index, duplicate, malformed record, and legacy standalone Quiz identifier. A missing `runtimeFence` alone is nonblocking. Any data remediation requires its own reviewed plan; neither tool repairs records. The older broad `prepareQuizIndexes.js --apply` must not be used against populated collections: it stops on nonempty collections and includes legacy-index drops.

Only after a clean report and separate owner authorization may an operator run `prepareStandaloneQuizIndexes.js --expected-db NAME --apply` against the isolated testing database. The script rechecks safety before each index, creates only missing required indexes (creating an absent required collection as a consequence of its first index), verifies the resulting exact definitions, and can be rerun. A partial failure may leave approved indexes already created; inspect the reported `created` list and rerun read-only inspection before any retry. It never drops indexes or edits documents. This tool intentionally refuses production targets; production needs its own reviewed procedure.

After creation, rerun both read-only reports. The runtime gate must then verify all six definitions, matching connected database name, replica-set/router session support, and an actual read-only snapshot transaction. Before testing UAT, verify the testing Backend and Frontend point only to isolated testing services, then explicitly enable the runtime in testing under separate approval. Keep production disabled. If an incident occurs, disable the runtime and preserve sessions, attempts, history, and indexes for investigation; do not automatically drop indexes or delete records.

If a deployment occurs before the required unique indexes exist, application-only checks cannot guarantee cross-instance session or submission uniqueness. Keep the runtime disabled until index and transaction verification is complete.
