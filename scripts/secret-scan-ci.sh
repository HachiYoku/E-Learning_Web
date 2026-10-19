#!/usr/bin/env bash
set -euo pipefail

# CI must execute this file, the scanner, and its configuration from the
# checked-out base commit. PR commits are fetched only as data, never checked out.
repo=$(git rev-parse --show-toplevel)
cd "$repo"

fail() { echo "Cannot establish a trusted secret-scan range; scan blocked." >&2; exit 1; }
sha_pattern='^[0-9a-f]{40}$'
[[ "${GITHUB_EVENT_NAME:-}" == pull_request_target ]] || fail
[[ "${GITHUB_REPOSITORY:-}" == HachiYoku/E-Learning_Web ]] || fail
[[ "${EVENT_REPOSITORY:-}" == "$GITHUB_REPOSITORY" ]] || fail
[[ "${EVENT_BASE_REPOSITORY:-}" == "$GITHUB_REPOSITORY" ]] || fail
[[ "${BASE_REF:-}" == testing-environment || "${BASE_REF:-}" == main ]] || fail
[[ "${BASE_SHA:-}" =~ $sha_pattern && "${HEAD_SHA:-}" =~ $sha_pattern ]] || fail
[[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] || fail
[[ "$(git rev-parse HEAD)" == "$BASE_SHA" ]] || fail

git fetch --no-tags origin "refs/pull/${PR_NUMBER}/head" || fail
[[ "$(git rev-parse FETCH_HEAD)" == "$HEAD_SHA" ]] || fail
base=$(git merge-base "$BASE_SHA" "$HEAD_SHA") || fail

bash scripts/secret-scan.sh range "$base" "$HEAD_SHA"
