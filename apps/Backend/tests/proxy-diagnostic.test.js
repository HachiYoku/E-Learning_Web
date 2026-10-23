const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { test } = require("node:test");
const express = require("express");
const { createProxyDiagnostic } = require("../middleware/proxyDiagnostic");

const token = crypto.randomBytes(32).toString("base64url");
const expectedIp = "198.51.100.25";
const syntheticIp = "192.0.2.10";
const now = Date.parse("2026-10-24T10:00:00Z");
const enabled = {
  PROXY_DIAGNOSTIC_ENABLED: "true",
  PROXY_DIAGNOSTIC_TOKEN: token,
  PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: expectedIp,
  PROXY_DIAGNOSTIC_EXPIRES_AT: "2026-10-24T10:30:00Z",
};

async function withHealth(config, run) {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/health", createProxyDiagnostic({ env: config, now: () => now, readyState: () => 1 }),
    (_req, res) => res.status(200).json({ status: "ok" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}/health`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("ordinary health checks and disabled diagnostics keep the normal response", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_ENABLED: "false" }, async (url) => {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    assert.deepEqual(await response.json(), { status: "ok" });
  });
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_ENABLED: undefined }, async (url) => {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("invalid authorization cannot obtain diagnostics", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: { authorization: `Bearer ${crypto.randomBytes(32).toString("base64url")}` } });
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("HEAD health requests never activate the GET-only diagnostic", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { method: "HEAD", headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), null);
    assert.equal(await response.text(), "");
  });
});

test("authorized diagnostics compare the independently configured client address", async () => {
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "127.0.0.1" }, async (url) => {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    assert.deepEqual((await response.json()).proxyDiagnostic, {
      matchesExpectedClient: true, matchesSyntheticForwarded: false,
    });
  });
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": expectedIp },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "ok", proxyDiagnostic: {
      matchesExpectedClient: true, matchesSyntheticForwarded: false,
    } });
  });
});

test("unavailable health remains unavailable without diagnostic disclosure", async () => {
  const app = express();
  app.get("/health", createProxyDiagnostic({ env: enabled, now: () => now, readyState: () => 0 }),
    (_req, res) => res.status(503).json({ status: "unavailable" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("synthetic forwarded input is reported only as comparisons", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": syntheticIp },
    });
    const body = await response.json();
    assert.deepEqual(body.proxyDiagnostic, {
      matchesExpectedClient: false, matchesSyntheticForwarded: true,
    });
    assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|198\.51\.100\.25|Bearer/);
  });
});

test("one-hop Express trust selects the rightmost address in a multi-address forwarded header", async () => {
  await withHealth(enabled, async (url) => {
    for (const [forwarded, expected] of [
      [`${syntheticIp}, 203.0.113.9`, { matchesExpectedClient: false, matchesSyntheticForwarded: false }],
      [`203.0.113.9, ${syntheticIp}`, { matchesExpectedClient: false, matchesSyntheticForwarded: true }],
    ]) {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwarded },
      });
      assert.deepEqual((await response.json()).proxyDiagnostic, expected);
    }
  });
});

test("a forged expected address yields equality, not independent proof", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": `${syntheticIp}, ${expectedIp}` },
    });
    const body = await response.json();
    assert.deepEqual(body.proxyDiagnostic, {
      matchesExpectedClient: true, matchesSyntheticForwarded: false,
    });
    assert.equal(Object.hasOwn(body.proxyDiagnostic, "conclusive"), false);
    assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|198\.51\.100\.25|Bearer/);
  });
});

test("missing, invalid, or expired independent client evidence disables diagnostics", async () => {
  const invalid = [
    { ...enabled, PROXY_DIAGNOSTIC_TOKEN: "" },
    { ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "" },
    { ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "not-an-address" },
    { ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: syntheticIp },
    { ...enabled, PROXY_DIAGNOSTIC_EXPIRES_AT: "2026-10-24T09:59:59Z" },
    { ...enabled, PROXY_DIAGNOSTIC_EXPIRES_AT: "2026-10-24T12:00:00Z" },
  ];
  for (const config of invalid) {
    await withHealth(config, async (url) => {
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      assert.deepEqual(await response.json(), { status: "ok" });
    });
  }
});
