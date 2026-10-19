#!/usr/bin/env bash
set -euo pipefail

# Keep local checks and CI on the same verified scanner release.
version=8.30.0
case "$(uname -s):$(uname -m)" in
  Darwin:arm64) platform=darwin_arm64; expected_sha=b251ab2bcd4cd8ba9e56ff37698c033ebf38582b477d21ebd86586d927cf87e7 ;;
  Linux:x86_64) platform=linux_x64; expected_sha=79a3ab579b53f71efd634f3aaf7e04a0fa0cf206b7ed434638d1547a2470a66e ;;
  *) echo "Unsupported platform for pinned Gitleaks; scan blocked." >&2; exit 1 ;;
esac

repo=$(git rev-parse --show-toplevel)
cd "$repo"

usage() {
  echo "Usage: scripts/secret-scan.sh staged | working | path PATH | range BASE HEAD | outgoing REMOTE BRANCH" >&2
  exit 2
}

case "${1:-}" in
  staged)
    [[ $# -eq 1 ]] || usage
    mode=staged
    ;;
  working)
    [[ $# -eq 1 ]] || usage
    mode=working
    ;;
  path)
    [[ $# -eq 2 && -e "$2" ]] || usage
    scan_path=$2
    mode=path
    ;;
  range)
    [[ $# -eq 3 ]] || usage
    base=$2
    head=$3
    mode=range
    ;;
  outgoing)
    [[ $# -eq 3 ]] || usage
    remote=$2
    branch=$3
    [[ "$branch" =~ ^[a-zA-Z0-9._/-]+$ ]] || usage
    remote_line=$(git ls-remote --exit-code "$remote" "refs/heads/$branch") || {
      echo "Cannot verify remote branch; scan blocked." >&2
      exit 1
    }
    base=${remote_line%%[[:space:]]*}
    head=HEAD
    mode=range
    ;;
  *) usage ;;
esac

if [[ "$mode" == range ]]; then
  git cat-file -e "${base}^{commit}" 2>/dev/null || { echo "Base commit unavailable; scan blocked." >&2; exit 1; }
  git cat-file -e "${head}^{commit}" 2>/dev/null || { echo "Head commit unavailable; scan blocked." >&2; exit 1; }
  git merge-base --is-ancestor "$base" "$head" || { echo "Push range is not fast-forward; scan blocked." >&2; exit 1; }
fi

# Gitleaks' Git-patch mode skips binary blobs. Inspect the exact index or every
# introduced commit (including merge-parent diffs) before running Gitleaks.
if [[ "$mode" == staged ]]; then
  node "$repo/scripts/secret-scan-blobs.js" staged
elif [[ "$mode" == range ]]; then
  node "$repo/scripts/secret-scan-blobs.js" range "$base" "$head"
fi

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
archive="gitleaks_${version}_${platform}.tar.gz"
curl --fail --silent --show-error --location --connect-timeout 10 --max-time 60 --output "$scratch/$archive" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}"
if command -v shasum >/dev/null 2>&1; then
  actual_sha=$(shasum -a 256 "$scratch/$archive" | cut -d ' ' -f 1)
else
  actual_sha=$(sha256sum "$scratch/$archive" | cut -d ' ' -f 1)
fi
[[ "$actual_sha" == "$expected_sha" ]] || { echo "Gitleaks checksum mismatch; scan blocked." >&2; exit 1; }
tar -xzf "$scratch/$archive" -C "$scratch" gitleaks

# Do not emit a finding's secret or leave a report containing it on disk.
if [[ "$mode" == staged ]]; then
  "$scratch/gitleaks" git --config "$repo/.gitleaks.toml" --staged --redact=100 --no-banner "$repo"
elif [[ "$mode" == working ]]; then
  "$scratch/gitleaks" git --config "$repo/.gitleaks.toml" --pre-commit --redact=100 --no-banner "$repo"
  while IFS= read -r -d '' file; do
    "$scratch/gitleaks" dir --config "$repo/.gitleaks.toml" --redact=100 --no-banner "$repo/$file"
  done < <(git ls-files --others --exclude-standard -z)
elif [[ "$mode" == path ]]; then
  "$scratch/gitleaks" dir --config "$repo/.gitleaks.toml" --redact=100 --no-banner "$scan_path"
else
  "$scratch/gitleaks" git --config "$repo/.gitleaks.toml" --log-opts="${base}..${head}" --redact=100 --no-banner "$repo"
fi
