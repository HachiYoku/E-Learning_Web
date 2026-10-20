const assert = require("node:assert/strict");
const { test } = require("node:test");
const { resolveListenHost, listenOnHost } = require("../config/listenHost");

function fakeServer() {
  const calls = [];
  const server = { listen(...args) { calls.push(args); return this; } };
  return { server, calls };
}

test("unset LISTEN_HOST retains the existing port-only listen signature", () => {
  const { server, calls } = fakeServer();
  const callback = () => {};
  const port = "3003";
  assert.equal(resolveListenHost({}), undefined);
  assert.equal(listenOnHost(server, port, resolveListenHost({}), callback), server);
  assert.deepEqual(calls, [[port, callback]]);
});

test("a loopback LISTEN_HOST is passed explicitly without changing PORT", () => {
  const { server, calls } = fakeServer();
  const callback = () => {};
  const port = "3003";
  const host = resolveListenHost({ LISTEN_HOST: "127.0.0.1" });
  assert.equal(listenOnHost(server, port, host, callback), server);
  assert.deepEqual(calls, [[port, "127.0.0.1", callback]]);
});

test("invalid or empty LISTEN_HOST fails before listening", () => {
  const { server, calls } = fakeServer();
  for (const host of ["", " ", "127.0.0.1 ", "http://127.0.0.1", "bad host", "-bad.example", "bad..example"]) {
    assert.throws(() => listenOnHost(server, "3003", resolveListenHost({ LISTEN_HOST: host }), () => {}),
      /LISTEN_HOST must be an IP address or DNS hostname/);
  }
  assert.deepEqual(calls, []);
});

test("valid DNS and IPv6 hosts preserve the supplied port", () => {
  for (const host of ["localhost", "::1"]) {
    const { server, calls } = fakeServer();
    const callback = () => {};
    listenOnHost(server, 3003, resolveListenHost({ LISTEN_HOST: host }), callback);
    assert.deepEqual(calls, [[3003, host, callback]]);
  }
});
