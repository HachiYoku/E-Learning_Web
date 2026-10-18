# Secret checks for commits and pushes

The repository uses Gitleaks v8.30.0 (release archives pinned by SHA-256) with its default rules plus a focused rule for credential-bearing MongoDB URIs. Git blobs that are binary, non-UTF-8, over 20 MiB, or marked binary by Git are blocked before the text scanner runs; request a separate review for such files. Checks scan all changed paths, including tests, fixtures, scripts, documentation, and configuration. No MongoDB URI allowlist is used.

Before each commit, run `bash scripts/secret-scan.sh staged` after staging. `bash scripts/secret-scan.sh working` scans the unstaged diff and untracked files during editing, but does not replace the staged check. Before a push to an existing branch, run `bash scripts/secret-scan.sh outgoing REMOTE BRANCH`. The outgoing check reads the current remote ref and scans every commit in the fast-forward range; fetch first if that commit is not available locally. It fails closed if the remote cannot be checked, its commit is missing locally, or the history diverged. For a new branch, the pre-push hook derives a baseline only from a verified ancestor branch on the actual destination remote. If none exists locally and remotely, the push is blocked; do not substitute a cached branch from another remote.

Repository-managed hooks in `.githooks/` can automate both local checks. Run `bash scripts/install-secret-hooks.sh --install` separately in each approved worktree, then `bash scripts/install-secret-hooks.sh --check` to verify Git resolves both executable hooks. Installation refuses an existing active hook or different hooks path instead of overwriting/bypassing it. It enables Git's worktree-specific configuration and sets the hooks path only for the selected worktree; no global Git configuration is changed. Hooks are intentionally not installed in ARUN THAI's real worktrees by this feature task. They fail closed when the scanner is unavailable, a reference cannot be verified, or a finding occurs.

GitHub Actions scans introduced commits in pull requests to `testing-environment`/`main` and pushes to those branches. Configure branch protection to require the **Secret scan / gitleaks** check before merging and restrict direct pushes separately. GitHub Actions runs after a direct push and cannot prevent that push by itself. Neither gate disables GitHub secret scanning or rewrites previously published history.

If a check flags a secret, stop; do not commit or push, paste the value into chat, or save an unredacted report. Determine whether it is a genuine credential. Rotate and revoke genuine credentials through the owner-approved process; replace synthetic credential-shaped fixtures with credential-free examples. Rerun staged and outgoing checks. Do not dismiss a GitHub alert without its separate review process.

## Temporary PR check

This documentation-only PR verifies that GitHub runs the `gitleaks` check before a change can enter `testing-environment`. Do not merge the PR.
