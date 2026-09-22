const assert = require("node:assert/strict");
const { once } = require("node:events");
const { afterEach, test } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const healthCheck = require("../middleware/health");
const errorHandler = require("../middleware/errorHandler");
const {
  requestId,
  requestCompletionLogger,
  sanitizeServerErrorResponses,
} = require("../middleware/monitoring");

const originalReadyState = mongoose.connection.readyState;

afterEach(() => {
  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value: originalReadyState,
  });
});

async function withServer(configure, run) {
  const app = express();
  app.use(requestId);
  app.use(requestCompletionLogger);
  app.use(sanitizeServerErrorResponses);
  configure(app);
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("healthy health endpoint is minimal and includes a request ID", async () => {
  Object.defineProperty(mongoose.connection, "readyState", { configurable: true, value: 1 });
  await withServer((app) => app.get("/health", healthCheck), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
  });
});

test("health endpoint reports unavailable when Mongoose is not ready", async () => {
  Object.defineProperty(mongoose.connection, "readyState", { configurable: true, value: 0 });
  await withServer((app) => app.get("/health", healthCheck), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
  });
});

test("unexpected errors have a generic response and retain the request ID", async () => {
  await withServer((app) => {
    app.get("/broken", (_req, _res, next) => next(new Error("MongoServerError: private host /srv/app/secrets")));
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/broken`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.message, "Internal server error");
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(body.requestId, response.headers.get("x-request-id"));
    assert.doesNotMatch(JSON.stringify(body), /MongoServerError|secrets|srv\/app/i);
  });
});

test("legacy controller-style 500 JSON responses are sanitized centrally", async () => {
  await withServer((app) => {
    app.get("/legacy-broken", (_req, res) => res.status(500).json({ message: "Cast to ObjectId failed for value secret" }));
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/legacy-broken`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.deepEqual(Object.keys(body).sort(), ["message", "requestId"]);
    assert.equal(body.message, "Internal server error");
    assert.doesNotMatch(JSON.stringify(body), /ObjectId|secret/i);
  });
});

test("intentional safe 4xx messages are unchanged", async () => {
  await withServer((app) => {
    app.get("/invalid", (_req, res) => res.status(400).json({ message: "Validation failure" }));
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/invalid`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: "Validation failure" });
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
  });
});
