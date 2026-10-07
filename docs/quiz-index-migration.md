# Quiz index preparation

This guarded, Quiz-only migration prepares the Phase 1–3C MongoDB collections
and indexes before enabling the new Quiz workflows. Normal Mongoose startup can
create missing indexes, but does not remove the old title-based Quiz indexes or
wait for all index builds before serving requests. Do not use blanket
`syncIndexes()` or manually delete indexes in Atlas when using this migration.

## Preconditions

- Obtain owner approval for each production operation. **Do not run Apply
  without separate, explicit owner approval.** This repository task only builds
  and tests the tool locally.
- Confirm the intended database name and obtain a suitable backup/export under
  the site's normal operational policy. The tool never prints the URI.
- Production is expected to have **zero** documents in `quizzes` and
  `quizattempts`, and no records in the other new Quiz collections. Any
  nonempty Quiz-related collection makes this initial rollout NOT READY.
- Hold Quiz writes and stop old Quiz-capable writers during Apply; keep them
  stopped through post-Apply verification. Unrelated collections are untouched.
- Supply `MONGO_DB` through the approved secure environment procedure, not in
  a command line or repository file. Set `QUIZ_INDEX_EXPECTED_DB=arunthai` and
  `NODE_ENV=production` for production. The URI must explicitly select that
  database. No `.env` file is loaded by this tool.

## Read-only preflight (default)

From `apps/Backend`, with the approved variables already in the environment:

```sh
npm run quizzes:prepare-indexes
```

This invocation is **read-only**: it uses native MongoDB inspection only, with
no Mongoose models, collection creation, document writes, or index writes.
It reports database name, collection existence/counts, every existing index,
correct/missing/mismatched requirements, recognized legacy indexes, and the
ordered Apply plan. `READY FOR APPLY` means the preconditions and exact index
definitions match the tool's expected state; it is not permission to Apply.
`NOT READY FOR APPLY` requires review. In particular, never assume an index is
safe to drop from its name alone. The migration checks the old Quiz title
indexes' keys, uniqueness, and partial filters against the historical schema.

## Apply (separate approval required)

After owner approval and a fresh preflight, with Quiz writers held:

```sh
npm run quizzes:prepare-indexes -- --apply
```

Apply reruns preflight and aborts without mutation unless it is READY. It
creates only missing Quiz-related collections/indexes, verifies all required
indexes including uniqueness and session TTL, then drops only the two exactly
recognized old Quiz title indexes, and verifies the final state. It never
deletes documents or `_id_`, unknown, or unrelated indexes. A normal restart
or deploy does not substitute for this verification.

## Partial runs and recovery

Index creation/drop operations are separate MongoDB operations, not one
transaction. Apply reports each completed operation and any sanitized failure.
If interrupted, keep Quiz writers held, run read-only preflight again, inspect
the reported actual index state, and resolve any mismatch before another Apply.
Already correct indexes/collections are skipped, so a verified partial run can
be rerun safely. Unknown indexes or changed/nonempty collections stop Apply;
do not force or manually drop them. After `APPLY COMPLETE`, run preflight once
more and check that no required indexes are missing, no legacy indexes remain,
and the TTL and partial unique options are exact before releasing Quiz writes.
