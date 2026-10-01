const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalizeReelUrl, resolveReelUrl } = require("../services/reelUrl");

const redirect = (location, status = 302) => ({ status, headers: { get: (name) => name.toLowerCase() === "location" ? location : null } });
const complete = () => ({ status: 200, headers: { get: () => null } });

test("normalizes supported public Reel URLs and derives their platforms", () => {
  assert.deepEqual(normalizeReelUrl("https://youtu.be/PXO2x2GDCFY?si=share"), { platform: "youtube", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY" });
  assert.deepEqual(normalizeReelUrl("https://www.youtube.com/shorts/PXO2x2GDCFY?feature=share"), { platform: "youtube", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY" });
  assert.deepEqual(normalizeReelUrl("https://www.tiktok.com/@arunthai/video/7123456789012345678?lang=en"), { platform: "tiktok", url: "https://www.tiktok.com/@arunthai/video/7123456789012345678" });
  assert.deepEqual(normalizeReelUrl("https://m.facebook.com/reel/123456789012345/"), { platform: "facebook", url: "https://www.facebook.com/reel/123456789012345/" });
  assert.deepEqual(normalizeReelUrl("https://www.facebook.com/arunthai/videos/123456789012345/"), { platform: "facebook", url: "https://www.facebook.com/arunthai/videos/123456789012345/" });
  assert.deepEqual(normalizeReelUrl("https://facebook.com/watch/?v=123456789012345"), { platform: "facebook", url: "https://www.facebook.com/watch/?v=123456789012345" });
});

test("rejects unsafe, malformed, spoofed, and unsupported social URLs", () => {
  const rejected = [
    "not a url",
    "http://www.youtube.com/watch?v=PXO2x2GDCFY",
    "https://user:pass@www.youtube.com/watch?v=PXO2x2GDCFY",
    "https://youtube.com.attacker.test/watch?v=PXO2x2GDCFY",
    "<iframe src='https://www.youtube.com/embed/PXO2x2GDCFY'></iframe>",
    "https://www.youtube.com/channel/example",
    "https://vm.tiktok.com/abc123/",
    "https://fb.watch/abc123/",
    "https://www.facebook.com/arunthai/posts/123456789012345/",
  ];
  for (const value of rejected) assert.throws(() => normalizeReelUrl(value));
});

test("resolves approved Facebook share links to canonical direct video and Reel URLs", async () => {
  const calls = [];
  let reelRequest = 0;
  const reel = await resolveReelUrl("https://www.facebook.com/share/v/19Z7yGiyve", { fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return reelRequest++ === 0 ? redirect("https://m.facebook.com/reel/123456789012345/") : complete();
  } });
  assert.deepEqual(reel, { platform: "facebook", url: "https://www.facebook.com/reel/123456789012345/" });
  assert.equal(calls[0].options.method, "HEAD");
  assert.equal(calls[0].options.redirect, "manual");

  let videoRequest = 0;
  const video = await resolveReelUrl("https://m.facebook.com/share/v/anotherShareId", { fetchImpl: async () => videoRequest++ === 0 ? redirect("/arunthai/videos/123456789012345/") : complete() });
  assert.deepEqual(video, { platform: "facebook", url: "https://www.facebook.com/arunthai/videos/123456789012345/" });
  assert.deepEqual(await resolveReelUrl("https://www.facebook.com/reel/123456789012345/"), reel);
});

test("rejects unsafe Facebook share redirects and resolution failures", async () => {
  const share = "https://www.facebook.com/share/v/19Z7yGiyve";
  const failures = [
    async () => redirect("https://attacker.example/reel/123"),
    async () => redirect("http://www.facebook.com/reel/123"),
    async () => redirect("https://user:pass@www.facebook.com/reel/123"),
    async () => redirect("https://www.facebook.com/arunthai/posts/123"),
    async () => { throw new Error("network unavailable"); },
    async () => redirect(null),
  ];
  for (const fetchImpl of failures) await assert.rejects(() => resolveReelUrl(share, { fetchImpl }));

  await assert.rejects(() => resolveReelUrl(share, { fetchImpl: async () => redirect("/share/v/19Z7yGiyve") }));
  await assert.rejects(() => resolveReelUrl("https://www.facebook.com/share/v/", { fetchImpl: async () => complete() }));
  await assert.rejects(() => resolveReelUrl("http://www.facebook.com/share/v/19Z7yGiyve", { fetchImpl: async () => complete() }));
  await assert.rejects(() => resolveReelUrl("https://www.facebook.com.attacker.test/share/v/19Z7yGiyve", { fetchImpl: async () => complete() }));
  await assert.rejects(() => resolveReelUrl("https://user:pass@www.facebook.com/share/v/19Z7yGiyve", { fetchImpl: async () => complete() }));
});
