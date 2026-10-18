const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const project = path.resolve(__dirname, "../..");
const legacyWorkflow = fs.readFileSync(path.join(project, ".github/workflows/secret-scan.yml"), "utf8");
const trustedWorkflow = fs.readFileSync(path.join(project, ".github/workflows/trusted-secret-scan.yml"), "utf8");
const wrapper = path.join(project, "scripts/secret-scan-ci.sh");
const repository = "HachiYoku/E-Learning_Web";

function run(cwd, bin, args, env = {}) {
  const result = spawnSync(bin, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  return result;
}
function git(cwd, ...args) {
  const result = run(cwd, "git", args);
  assert.equal(result.status, 0, `Fixture Git command failed: ${args[0]}`);
  return result.stdout.trim();
}
function commit(cwd, message) {
  git(cwd, "add", "-A");
  git(cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", message);
  return git(cwd, "rev-parse", "HEAD");
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-trusted-ci-"));
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-trusted-ci-remote-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  git(dir, "init", "-q");
  git(remote, "init", "--bare", "-q");
  git(dir, "remote", "add", "origin", remote);
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
  fs.copyFileSync(wrapper, path.join(dir, "scripts/secret-scan-ci.sh"));
  fs.copyFileSync(path.join(project, "scripts/secret-scan-blobs.js"),
    path.join(dir, "scripts/secret-scan-blobs.js"));
  fs.writeFileSync(path.join(dir, ".github/workflows/secret-scan.yml"), legacyWorkflow);
  fs.writeFileSync(path.join(dir, ".github/workflows/trusted-secret-scan.yml"), trustedWorkflow);
  fs.writeFileSync(path.join(dir, ".gitleaks.toml"), "trusted fixture rules\n");
  fs.writeFileSync(path.join(dir, "scripts/secret-scan.sh"), [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "[[ \"$(cat .gitleaks.toml)\" == 'trusted fixture rules' ]] || exit 17",
    "printf '%s %s\\n' \"$2\" \"$3\" >> \"$SCAN_LOG\"",
    "while IFS= read -r revision; do",
    "  if git show \"$revision:canary.txt\" 2>/dev/null | grep -q 'HARMLESS_CANARY'; then exit 19; fi",
    "done < <(git rev-list \"$2..$3\")",
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "readme.txt"), "baseline\n");
  const base = commit(dir, "trusted base");
  git(dir, "push", "-q", "origin", "HEAD:refs/heads/testing-environment");
  const log = path.join(dir, "scan.log");
  return { dir, remote, base, log };
}
function checkPr(setup, head, number = "7") {
  git(setup.dir, "push", "-q", "origin", `${head}:refs/pull/${number}/head`);
  git(setup.dir, "switch", "-q", "--detach", setup.base);
  return run(setup.dir, "bash", ["scripts/secret-scan-ci.sh"], {
    ...eventEnv(setup, head, { PR_NUMBER: number }),
  });
}
function eventEnv(setup, head, overrides = {}) {
  return {
    GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REPOSITORY: repository,
    EVENT_REPOSITORY: repository, EVENT_BASE_REPOSITORY: repository,
    BASE_REF: "testing-environment", BASE_SHA: setup.base, HEAD_SHA: head,
    PR_NUMBER: "7", SCAN_LOG: setup.log, ...overrides,
  };
}

test("legacy PR and push scanning stays byte-for-byte unchanged", () => {
  const committed = run(project, "git", ["show", "HEAD:.github/workflows/secret-scan.yml"]);
  assert.equal(committed.status, 0);
  assert.equal(legacyWorkflow, committed.stdout);
  assert.match(legacyWorkflow, /\bpull_request:\s*\n\s*branches: \[testing-environment, main\]/);
  assert.match(legacyWorkflow, /\bpush:\s*\n\s*branches: \[testing-environment, main\]/);
  assert.match(legacyWorkflow, /\bgitleaks:\s*\n/);
});

test("trusted job is additive, read-only, and checks out only the PR base", () => {
  assert.match(trustedWorkflow, /\bpull_request_target:\s*\n\s*branches: \[testing-environment, main\]/);
  assert.match(trustedWorkflow, /\btrusted-gitleaks:\s*\n/);
  assert.doesNotMatch(trustedWorkflow, /^\s*push:\s*$/m);
  assert.match(trustedWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.match(trustedWorkflow, /persist-credentials: false/);
  assert.match(trustedWorkflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(trustedWorkflow, /run: bash scripts\/secret-scan-ci\.sh/);
  assert.doesNotMatch(trustedWorkflow, /run:.*pull_request\.head\.sha/);
});

test("clean PR scans the proposed head from the trusted base checkout", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, "readme.txt"), "safe PR change\n");
  const head = commit(setup.dir, "safe PR");
  const result = checkPr(setup, head);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(setup.log, "utf8").trim(), `${setup.base} ${head}`);
});

test("PR edits to scanner scripts cannot disable the base scanner", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, "scripts/secret-scan.sh"), "#!/bin/sh\nexit 0\n");
  fs.writeFileSync(path.join(setup.dir, "scripts/secret-scan-ci.sh"), "#!/bin/sh\nexit 0\n");
  fs.writeFileSync(path.join(setup.dir, "scripts/secret-scan-blobs.js"), "process.exit(0);\n");
  fs.writeFileSync(path.join(setup.dir, "canary.txt"), "HARMLESS_CANARY\n");
  const head = commit(setup.dir, "attempt to weaken scanner");
  const result = checkPr(setup, head);
  assert.equal(result.status, 19);
  assert.equal(fs.readFileSync(setup.log, "utf8").trim(), `${setup.base} ${head}`);
  assert.notEqual(fs.readFileSync(path.join(setup.dir, "scripts/secret-scan-ci.sh"), "utf8"), "#!/bin/sh\nexit 0\n");
});

test("PR edits to Gitleaks rules cannot disable trusted rules", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, ".gitleaks.toml"), "weakened fixture rules\n");
  fs.writeFileSync(path.join(setup.dir, "canary.txt"), "HARMLESS_CANARY\n");
  const head = commit(setup.dir, "attempt to weaken rules");
  const result = checkPr(setup, head);
  assert.equal(result.status, 19);
  assert.equal(fs.readFileSync(path.join(setup.dir, ".gitleaks.toml"), "utf8"), "trusted fixture rules\n");
});

test("PR edits to either workflow cannot change the trusted checkout or scan", (t) => {
  const setup = fixture(t);
  for (const name of ["secret-scan.yml", "trusted-secret-scan.yml"]) {
    fs.writeFileSync(path.join(setup.dir, ".github/workflows", name),
      "name: untrusted fixture\non: pull_request\njobs: {}\n");
  }
  fs.writeFileSync(path.join(setup.dir, "canary.txt"), "HARMLESS_CANARY\n");
  const head = commit(setup.dir, "attempt to change workflows");
  assert.equal(checkPr(setup, head).status, 19);
  assert.equal(fs.readFileSync(path.join(setup.dir, ".github/workflows/trusted-secret-scan.yml"), "utf8"),
    trustedWorkflow);
});

test("earlier PR commits are scanned even if a later commit removes the canary", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, "canary.txt"), "HARMLESS_CANARY\n");
  commit(setup.dir, "add harmless canary");
  fs.unlinkSync(path.join(setup.dir, "canary.txt"));
  const head = commit(setup.dir, "remove harmless canary");
  assert.equal(checkPr(setup, head).status, 19);
});

test("missing and invalid event metadata fail closed before scanning", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, "readme.txt"), "safe PR\n");
  const head = commit(setup.dir, "safe PR");
  git(setup.dir, "switch", "-q", "--detach", setup.base);
  const invalid = [
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_REPOSITORY: "" },
    { EVENT_REPOSITORY: "different/repository" },
    { EVENT_BASE_REPOSITORY: "different/repository" },
    { BASE_REF: "untrusted-branch" },
    { BASE_SHA: "" },
    { HEAD_SHA: "not-a-sha" },
    { PR_NUMBER: "" },
    { PR_NUMBER: "7; exit 0" },
  ];
  for (const overrides of invalid) {
    const result = run(setup.dir, "bash", ["scripts/secret-scan-ci.sh"],
      eventEnv(setup, head, overrides));
    assert.notEqual(result.status, 0, `Unexpected success for ${Object.keys(overrides)[0]}`);
  }
  const unavailable = run(setup.dir, "bash", ["scripts/secret-scan-ci.sh"], eventEnv(setup, head));
  assert.notEqual(unavailable.status, 0);
  assert.equal(fs.existsSync(setup.log), false);
});

test("a stale PR event SHA or wrong base checkout cannot scan another revision", (t) => {
  const setup = fixture(t);
  fs.writeFileSync(path.join(setup.dir, "readme.txt"), "first revision\n");
  const first = commit(setup.dir, "first revision");
  git(setup.dir, "push", "-q", "origin", `${first}:refs/pull/7/head`);
  fs.writeFileSync(path.join(setup.dir, "readme.txt"), "second revision\n");
  const second = commit(setup.dir, "second revision");

  git(setup.dir, "switch", "-q", "--detach", setup.base);
  const stale = run(setup.dir, "bash", ["scripts/secret-scan-ci.sh"], eventEnv(setup, second));
  assert.notEqual(stale.status, 0);
  assert.equal(fs.existsSync(setup.log), false);

  git(setup.dir, "switch", "-q", "--detach", first);
  const wrongBase = run(setup.dir, "bash", ["scripts/secret-scan-ci.sh"], eventEnv(setup, first));
  assert.notEqual(wrongBase.status, 0);
  assert.equal(fs.existsSync(setup.log), false);
});
