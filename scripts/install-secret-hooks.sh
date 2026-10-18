#!/usr/bin/env bash
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
expected="$repo/.githooks"
mode=${1:---check}
[[ "$mode" == --check || "$mode" == --install ]] || {
  echo "Usage: scripts/install-secret-hooks.sh --check|--install" >&2
  exit 2
}
for hook in pre-commit pre-push; do
  [[ -x "$expected/$hook" ]] || { echo "Repository $hook is missing or not executable." >&2; exit 1; }
done

effective=$(git config --path --get core.hooksPath || true)
if [[ -n "$effective" && "$effective" != "$expected" ]]; then
  echo "Another hooks path is configured; refusing to replace it." >&2
  exit 1
fi

if [[ "$mode" == --install && -z "$effective" ]]; then
  default_hooks=$(git rev-parse --git-path hooks)
  for hook in pre-commit pre-push; do
    if [[ -x "$default_hooks/$hook" ]]; then
      echo "An active default $hook exists; refusing to bypass it." >&2
      exit 1
    fi
  done
  # The extension enables a separate config.worktree per linked worktree.
  # It does not set hooksPath in any other worktree.
  git config --local extensions.worktreeConfig true
  git config --worktree core.hooksPath "$expected"
fi

[[ "$(git config --worktree --path --get core.hooksPath 2>/dev/null || true)" == "$expected" ]] || {
  echo "Worktree-specific hooks path is not installed; checks are not automatic." >&2
  exit 1
}
[[ "$(git config --path --get core.hooksPath)" == "$expected" ]] || {
  echo "Git does not resolve to the repository hooks; checks are not automatic." >&2
  exit 1
}
echo "Both secret-check hooks are active for this worktree."
