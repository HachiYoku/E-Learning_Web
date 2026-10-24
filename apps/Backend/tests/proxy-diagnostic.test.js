const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { test } = require("node:test");
const express = require("express");
const { createProxyDiagnostic } = require("../middleware/proxyDiagnostic");

const token = crypto.randomBytes(32).toString("base64url");
const expectedIp = "198.51.100.25";
const syntheticIp = "192.0.2.10";
const controlledIp = "203.0.113.77";
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

function originalComparisons(diagnostic) {
  const { matchesExpectedClient, matchesExpectedClientNormalized, matchesSyntheticForwarded } = diagnostic;
  return { matchesExpectedClient, matchesExpectedClientNormalized, matchesSyntheticForwarded };
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
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${crypto.randomBytes(32).toString("base64url")}`,
      "x-forwarded-for": `${controlledIp}, ${expectedIp}`,
    } });
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
    assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), {
      matchesExpectedClient: true, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
    });
  });
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": expectedIp },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.deepEqual(originalComparisons(body.proxyDiagnostic), {
      matchesExpectedClient: true, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
    });
  });
});

test("IPv4-mapped IPv6 matches IPv4 only in the normalized comparison", async () => {
  await withHealth(enabled, async (url) => {
    for (const forwarded of ["::ffff:198.51.100.25", "0:0:0:0:0:ffff:c633:6419"]) {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwarded },
      });
      assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), {
        matchesExpectedClient: false, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
      });
    }
  });
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "::ffff:198.51.100.25" }, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": expectedIp },
    });
    assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), {
      matchesExpectedClient: false, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
    });
  });
});

test("unrelated IPv4 and IPv6 addresses do not normalize to a match", async () => {
  await withHealth(enabled, async (url) => {
    for (const forwarded of ["198.51.100.26", "::ffff:198.51.100.26", "::ffff:0:198.51.100.25", "not-an-ip"]) {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwarded },
      });
      assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), {
        matchesExpectedClient: false, matchesExpectedClientNormalized: false, matchesSyntheticForwarded: false,
      });
    }
  });
});

test("equivalent IPv6 spellings match without equating different IPv6 addresses", async () => {
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "2001:db8::1" }, async (url) => {
    for (const [forwarded, matches] of [
      ["2001:0DB8:0:0:0:0:0:1", true],
      ["2001:db8::2", false],
    ]) {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwarded },
      });
      assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), {
        matchesExpectedClient: false, matchesExpectedClientNormalized: matches, matchesSyntheticForwarded: false,
      });
    }
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
    assert.deepEqual(originalComparisons(body.proxyDiagnostic), {
      matchesExpectedClient: false, matchesExpectedClientNormalized: false, matchesSyntheticForwarded: true,
    });
    assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|198\.51\.100\.25|Bearer/);
  });
});

test("one-hop Express trust selects the rightmost address in a multi-address forwarded header", async () => {
  await withHealth(enabled, async (url) => {
    for (const [forwarded, expected] of [
      [`${syntheticIp}, 203.0.113.9`, { matchesExpectedClient: false, matchesExpectedClientNormalized: false, matchesSyntheticForwarded: false }],
      [`203.0.113.9, ${syntheticIp}`, { matchesExpectedClient: false, matchesExpectedClientNormalized: false, matchesSyntheticForwarded: true }],
    ]) {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwarded },
      });
      assert.deepEqual(originalComparisons((await response.json()).proxyDiagnostic), expected);
    }
  });
});

test("a forged expected address yields equality, not independent proof", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": `${syntheticIp}, ${expectedIp}` },
    });
    const body = await response.json();
    assert.deepEqual(originalComparisons(body.proxyDiagnostic), {
      matchesExpectedClient: true, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
    });
    assert.equal(Object.hasOwn(body.proxyDiagnostic, "conclusive"), false);
    assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|198\.51\.100\.25|Bearer/);
  });
});

test("a forged mapped address can match after normalization without proving proxy safety", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": `${syntheticIp}, ::ffff:198.51.100.25` },
    });
    const body = await response.json();
    assert.deepEqual(originalComparisons(body.proxyDiagnostic), {
      matchesExpectedClient: false, matchesExpectedClientNormalized: true, matchesSyntheticForwarded: false,
    });
    assert.equal(Object.hasOwn(body.proxyDiagnostic, "conclusive"), false);
    assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|198\.51\.100\.25|Bearer/);
  });
});

test("normal multi-hop forwarding identifies chain presence and the selected rightmost hop", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": `${expectedIp}, 192.0.2.20`,
    } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()).proxyDiagnostic, {
      matchesExpectedClient: false,
      matchesExpectedClientNormalized: false,
      matchesSyntheticForwarded: false,
      matchesControlledSyntheticForwarded: false,
      matchesSocketPeer: false,
      forwardedChainInspected: true,
      expectedClientInForwardedChain: true,
      controlledSyntheticInForwardedChain: false,
      selectedForwardedPosition: "rightmost",
    });
  });
});

test("authorized diagnostic responses contain exactly the approved fields and no sensitive values", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": `${controlledIp}, ${expectedIp}`,
    } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["proxyDiagnostic", "status"]);
    assert.deepEqual(Object.keys(body.proxyDiagnostic).sort(), [
      "controlledSyntheticInForwardedChain",
      "expectedClientInForwardedChain",
      "forwardedChainInspected",
      "matchesControlledSyntheticForwarded",
      "matchesExpectedClient",
      "matchesExpectedClientNormalized",
      "matchesSocketPeer",
      "matchesSyntheticForwarded",
      "selectedForwardedPosition",
    ]);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes(token), false);
    assert.doesNotMatch(serialized, /(?:\d{1,3}\.){3}\d{1,3}|x-forwarded-for|authorization|Bearer/i);
  });
});

test("controlled forged input is visible in the chain without becoming Express req.ip", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": `${controlledIp}, ${expectedIp}, 192.0.2.20`,
    } });
    const body = await response.json();
    assert.equal(body.proxyDiagnostic.controlledSyntheticInForwardedChain, true);
    assert.equal(body.proxyDiagnostic.matchesControlledSyntheticForwarded, false);
    assert.equal(body.proxyDiagnostic.expectedClientInForwardedChain, true);
    assert.equal(body.proxyDiagnostic.selectedForwardedPosition, "rightmost");
    assert.doesNotMatch(JSON.stringify(body), /203\.0\.113\.77|198\.51\.100\.25|192\.0\.2\.20|Bearer/);
  });
});

test("a forged rightmost address can become req.ip under one-hop trust", async () => {
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": `${expectedIp}, 192.0.2.20, ${controlledIp}`,
    } });
    const diagnostic = (await response.json()).proxyDiagnostic;
    assert.equal(diagnostic.matchesControlledSyntheticForwarded, true);
    assert.equal(diagnostic.controlledSyntheticInForwardedChain, true);
    assert.equal(diagnostic.selectedForwardedPosition, "rightmost");
  });
});

test("socket selection and repeated forwarded positions remain categorical", async () => {
  await withHealth({ ...enabled, PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP: "127.0.0.1" }, async (url) => {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const diagnostic = (await response.json()).proxyDiagnostic;
    assert.equal(diagnostic.matchesSocketPeer, true);
    assert.equal(diagnostic.forwardedChainInspected, true);
    assert.equal(diagnostic.selectedForwardedPosition, "none");
  });
  await withHealth(enabled, async (url) => {
    const response = await fetch(url, { headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": `${controlledIp}, ${controlledIp}`,
    } });
    assert.equal((await response.json()).proxyDiagnostic.selectedForwardedPosition, "multiple");
  });
});

test("malformed forwarding input is not classified as an inspected chain", async () => {
  await withHealth(enabled, async (url) => {
    for (const forwarded of [
      `${expectedIp}, not-an-ip`,
      Array(17).fill(controlledIp).join(", "),
      Array(170).fill(controlledIp).join(","),
    ]) {
      const response = await fetch(url, { headers: {
        authorization: `Bearer ${token}`, "x-forwarded-for": forwarded,
      } });
      assert.equal(response.status, 200);
      const body = await response.json();
      const diagnostic = body.proxyDiagnostic;
      assert.equal(diagnostic.forwardedChainInspected, false);
      assert.equal(diagnostic.expectedClientInForwardedChain, false);
      assert.equal(diagnostic.selectedForwardedPosition, "unavailable");
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes(token), false);
      assert.doesNotMatch(serialized, /(?:\d{1,3}\.){3}\d{1,3}|x-forwarded-for|authorization|Bearer/i);
    }
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
      const response = await fetch(url, { headers: {
        authorization: `Bearer ${token}`, "x-forwarded-for": `${controlledIp}, ${expectedIp}`,
      } });
      assert.deepEqual(await response.json(), { status: "ok" });
    });
  }
});
