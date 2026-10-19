#!/usr/bin/env node
// Gitleaks' git mode reads textual patches. Reject blobs that Git treats as
// binary, contain NUL/non-UTF-8 bytes, or exceed our reliable inspection bound.
const { spawnSync } = require("node:child_process");
const { TextDecoder } = require("node:util");

const MAX_BLOB_BYTES = 20 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

function git(...args) {
  const result = spawnSync("git", args, { encoding: null, maxBuffer: MAX_BLOB_BYTES + 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Git blob inspection failed; scan blocked.");
  return result.stdout;
}

function paths(output) {
  return output.toString("utf8").split("\0").filter(Boolean);
}

function inspect(path, source, comparison) {
  const label = JSON.stringify(path);
  const oid = git("rev-parse", "--verify", source === "index" ? `:0:${path}` : `${source}:${path}`)
    .toString("ascii").trim();
  if (git("cat-file", "-t", oid).toString("ascii").trim() !== "blob") {
    throw new Error(`Non-file Git object at ${label}; scan blocked.`);
  }
  const size = Number(git("cat-file", "-s", oid).toString("ascii").trim());
  if (!Number.isSafeInteger(size) || size > MAX_BLOB_BYTES) {
    throw new Error(`Oversized or unscannable blob at ${label}; scan blocked.`);
  }
  const blob = git("cat-file", "blob", oid);
  const diff = comparison === "index"
    ? git("diff", "--cached", "--no-ext-diff", "--numstat", "HEAD", "--", path)
    : git("diff", "--no-ext-diff", "--numstat", comparison, source, "--", path);
  if (blob.includes(0) || /^-\t-\t/m.test(diff.toString("utf8"))) {
    throw new Error(`Binary blob at ${label}; scan blocked.`);
  }
  try { decoder.decode(blob); } catch {
    throw new Error(`Non-UTF-8 blob at ${label}; scan blocked.`);
  }
}

function inspectStaged() {
  for (const path of paths(git("diff", "--cached", "--name-only", "-z", "-M",
    "--diff-filter=ACMRT", "HEAD"))) inspect(path, "index", "index");
}

function inspectRange(base, head) {
  const commits = git("rev-list", "--reverse", "--topo-order", `${base}..${head}`)
    .toString("ascii").trim().split("\n").filter(Boolean);
  for (const commit of commits) {
    const [, ...parents] = git("rev-list", "--parents", "-n", "1", commit)
      .toString("ascii").trim().split(" ");
    if (!parents.length) throw new Error("Root commit has no verified baseline; scan blocked.");
    for (const parent of parents) {
      for (const path of paths(git("diff", "--name-only", "-z", "-M",
        "--diff-filter=ACMRT", parent, commit))) inspect(path, commit, parent);
    }
  }
}

try {
  const [mode, base, head] = process.argv.slice(2);
  if (mode === "staged" && !base && !head) inspectStaged();
  else if (mode === "range" && base && head) inspectRange(base, head);
  else throw new Error("Invalid blob-inspection mode; scan blocked.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
