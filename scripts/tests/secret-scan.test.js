const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const project = path.resolve(__dirname, "../..");
const blobs = path.join(project, "scripts/secret-scan-blobs.js");
const scanner = path.join(project, "scripts/secret-scan.sh");
const pushHook = path.join(project, ".githooks/pre-push");
const installer = path.join(project, "scripts/install-secret-hooks.sh");
const fakeCredential = ["mongodb+srv://", "fake-review-user:",
  "Z7y5X3w1V9u8T6s4R2q0P8n6M4k2J0h9", "@synthetic.example.invalid/fixture"].join("");
const zero = "0".repeat(40);

function command(cwd, bin, args, options = {}) {
  const result = spawnSync(bin, args, { cwd, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}
function git(cwd, ...args) {
  const result = command(cwd, "git", args);
  assert.equal(result.status, 0, `Git test setup failed: ${args[0]}`);
  return result.stdout.trim();
}
function commit(cwd, message) {
  git(cwd, "add", "-A");
  git(cwd, "-c", "user.name=Isolated Review", "-c", "user.email=review@example.invalid",
    "commit", "-qm", message);
  return git(cwd, "rev-parse", "HEAD");
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-secret-check-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q");
  fs.writeFileSync(path.join(dir, "safe.txt"), "ordinary text\n");
  const base = commit(dir, "baseline");
  return { dir, base };
}
function inspect(cwd, ...args) { return command(cwd, process.execPath, [blobs, ...args]); }

test("staged binary blob is blocked even when the working file is clean", (t) => {
  const { dir } = fixture(t);
  const name = "odd name\nasset.bin";
  fs.writeFileSync(path.join(dir, name), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(fakeCredential)]));
  git(dir, "add", "--", name);
  fs.writeFileSync(path.join(dir, name), "now harmless text\n");
  const result = inspect(dir, "staged");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Binary blob/);
  assert.ok(!result.stderr.includes(fakeCredential));
  assert.match(result.stderr, /odd name/);
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(blobs, path.join(dir, "scripts/secret-scan-blobs.js"));
  const gate = command(dir, "bash", [scanner, "staged"]);
  assert.notEqual(gate.status, 0);
  assert.match(gate.stderr, /Binary blob/);
});

test("safe staged text passes; Git-marked binary text is blocked", (t) => {
  const { dir } = fixture(t);
  fs.writeFileSync(path.join(dir, "safe.txt"), "safe replacement\n");
  git(dir, "add", "safe.txt");
  assert.equal(inspect(dir, "staged").status, 0);
  fs.writeFileSync(path.join(dir, ".gitattributes"), "*.opaque -diff\n");
  fs.writeFileSync(path.join(dir, "file.opaque"), "valid UTF-8, but Git hides the patch\n");
  git(dir, "add", ".gitattributes", "file.opaque");
  assert.notEqual(inspect(dir, "staged").status, 0);
});

test("range checks a binary in an earlier commit even after deletion", (t) => {
  const { dir, base } = fixture(t);
  fs.writeFileSync(path.join(dir, "asset.bin"), Buffer.concat([Buffer.from([0]), Buffer.from(fakeCredential)]));
  commit(dir, "add synthetic binary");
  fs.unlinkSync(path.join(dir, "asset.bin"));
  const head = commit(dir, "remove synthetic binary");
  const result = inspect(dir, "range", base, head);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /asset.bin/);
  assert.ok(!result.stderr.includes(fakeCredential));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(blobs, path.join(dir, "scripts/secret-scan-blobs.js"));
  const gate = command(dir, "bash", [scanner, "range", base, head]);
  assert.notEqual(gate.status, 0);
  assert.match(gate.stderr, /asset.bin/);
});

test("a renamed binary remains blocked and reports the destination path", (t) => {
  const { dir } = fixture(t);
  fs.writeFileSync(path.join(dir, "old.bin"), Buffer.from([0, 1, 2, 3]));
  const base = commit(dir, "old binary fixture");
  git(dir, "mv", "old.bin", "renamed asset.bin");
  const head = commit(dir, "rename binary fixture");
  const result = inspect(dir, "range", base, head);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /renamed asset.bin/);
});

function remoteFixture(t) {
  const { dir, base } = fixture(t);
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-secret-remote-"));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  git(remote, "init", "--bare", "-q");
  git(dir, "remote", "add", "origin", remote);
  git(dir, "push", "--no-verify", "-q", "origin", "HEAD:refs/heads/testing-environment");
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "scripts/secret-scan.sh"),
    "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$SECRET_SCAN_TEST_LOG\"\nexit \"${SECRET_SCAN_TEST_EXIT:-0}\"\n",
    { mode: 0o755 });
  const log = path.join(os.tmpdir(), `arunthai-secret-refs-${path.basename(dir)}`);
  t.after(() => fs.rmSync(log, { force: true }));
  fs.writeFileSync(path.join(dir, "safe.txt"), "local update\n");
  const head = commit(dir, "local change");
  return { dir, remote, base, head, log };
}
function runHook(setup, lines, remoteName = "origin", remoteUrl = setup.remote, extraEnv = {}) {
  return command(setup.dir, "bash", [pushHook, remoteName, remoteUrl], {
    input: lines.join("\n") + "\n",
    env: { ...process.env, SECRET_SCAN_TEST_LOG: setup.log, ...extraEnv },
  });
}
function logLines(log) { return fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []; }

test("existing remote ref scans its exact old-to-new range, including multiple updates", (t) => {
  const setup = remoteFixture(t);
  git(setup.dir, "push", "--no-verify", "-q", "origin", `${setup.base}:refs/heads/second`);
  const first = `refs/heads/local ${setup.head} refs/heads/testing-environment ${setup.base}`;
  const second = `refs/heads/local ${setup.head} refs/heads/second ${setup.base}`;
  assert.equal(runHook(setup, [first, second]).status, 0);
  assert.deepEqual(logLines(setup.log), [`range ${setup.base} ${setup.head}`, `range ${setup.base} ${setup.head}`]);
  assert.notEqual(runHook(setup, [first], "origin", setup.remote,
    { SECRET_SCAN_TEST_EXIT: "7" }).status, 0);
});

test("new destination branch uses only an ancestor verified on that remote", (t) => {
  const setup = remoteFixture(t);
  const update = `refs/heads/local ${setup.head} refs/heads/new-feature ${zero}`;
  assert.equal(runHook(setup, [update]).status, 0);
  assert.deepEqual(logLines(setup.log), [`range ${setup.base} ${setup.head}`]);
  const unrelated = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-other-remote-"));
  t.after(() => fs.rmSync(unrelated, { recursive: true, force: true }));
  git(unrelated, "init", "--bare", "-q");
  git(setup.dir, "remote", "add", "other", unrelated);
  assert.notEqual(runHook(setup, [update], "other", unrelated).status, 0);
  assert.equal(logLines(setup.log).length, 1);
});

test("remote mismatch, missing remote SHA, and non-fast-forward ranges fail closed", (t) => {
  const setup = remoteFixture(t);
  const stale = `refs/heads/local ${setup.head} refs/heads/testing-environment ${setup.head}`;
  assert.notEqual(runHook(setup, [stale]).status, 0);
  const missing = `refs/heads/local ${setup.head} refs/heads/testing-environment ${"f".repeat(40)}`;
  assert.notEqual(runHook(setup, [missing]).status, 0);
  assert.equal(logLines(setup.log).length, 0);
  assert.notEqual(command(setup.dir, "bash", [scanner, "range", setup.head, setup.base]).status, 0);
});

test("hook installer isolates a linked worktree and refuses existing active hooks", (t) => {
  const setup = remoteFixture(t);
  const linked = fs.mkdtempSync(path.join(os.tmpdir(), "arunthai-linked-hooks-"));
  fs.rmSync(linked, { recursive: true, force: true });
  git(setup.dir, "worktree", "add", "-q", "-b", "hook-test", linked);
  try {
    fs.mkdirSync(path.join(linked, ".githooks"));
    for (const name of ["pre-commit", "pre-push"]) {
      fs.copyFileSync(path.join(project, ".githooks", name), path.join(linked, ".githooks", name));
      fs.chmodSync(path.join(linked, ".githooks", name), 0o755);
    }
    fs.mkdirSync(path.join(linked, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(linked, "scripts/secret-scan.sh"),
      "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$SECRET_SCAN_TEST_LOG\"\nexit 7\n", { mode: 0o755 });
    const hookLog = path.join(linked, "hook-calls.log");
    const hookEnv = { ...process.env, SECRET_SCAN_TEST_LOG: hookLog };
    assert.equal(command(linked, "bash", [installer, "--install"]).status, 0);
    assert.equal(command(linked, "bash", [installer, "--check"]).status, 0);
    assert.notEqual(command(setup.dir, "git", ["config", "--worktree", "--get", "core.hooksPath"]).status, 0);
    fs.writeFileSync(path.join(linked, "probe.txt"), "safe\n");
    git(linked, "add", "probe.txt");
    assert.notEqual(command(linked, "git", ["-c", "user.name=Review", "-c", "user.email=review@example.invalid",
      "commit", "-qm", "hook executes"], { env: hookEnv }).status, 0);
    assert.notEqual(command(linked, "git", ["push", "origin", "HEAD:refs/heads/testing-environment"],
      { env: hookEnv }).status, 0);
    assert.match(fs.readFileSync(hookLog, "utf8"), /staged/);
    assert.match(fs.readFileSync(hookLog, "utf8"), /range /);
  } finally {
    command(setup.dir, "git", ["worktree", "remove", "--force", linked]);
  }
});

test("hook installer will not bypass a pre-existing active hook", (t) => {
  const { dir } = fixture(t);
  fs.mkdirSync(path.join(dir, ".githooks"));
  for (const name of ["pre-commit", "pre-push"]) {
    fs.copyFileSync(path.join(project, ".githooks", name), path.join(dir, ".githooks", name));
    fs.chmodSync(path.join(dir, ".githooks", name), 0o755);
  }
  const gitHooksPath = git(dir, "rev-parse", "--git-path", "hooks");
  const defaultHooks = path.resolve(dir, gitHooksPath);
  fs.writeFileSync(path.join(defaultHooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  assert.notEqual(command(dir, "bash", [installer, "--install"]).status, 0);
  assert.equal(fs.readFileSync(path.join(defaultHooks, "pre-commit"), "utf8"), "#!/bin/sh\nexit 0\n");
});
