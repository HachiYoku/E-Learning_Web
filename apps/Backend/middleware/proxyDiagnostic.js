const crypto = require("node:crypto");
const net = require("node:net");
const mongoose = require("mongoose");

const SYNTHETIC_FORWARDED_IP = "192.0.2.10";
const MAX_LIFETIME_MS = 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function normalizedIp(value) {
  const family = net.isIP(value);
  if (family === 4) return `ipv4:${value}`;
  if (family !== 6) return null;

  // Validate first, then use the URL parser's canonical IPv6 representation.
  // Only the exact IPv4-mapped range (::ffff:0:0/96) is equivalent to IPv4.
  try {
    const canonical = new URL(`http://[${value}]/`).hostname;
    const mapped = /^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/.exec(canonical);
    if (mapped) {
      const high = Number.parseInt(mapped[1], 16);
      const low = Number.parseInt(mapped[2], 16);
      return `ipv4:${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
    }
    return `ipv6:${canonical}`;
  } catch {
    return null;
  }
}

// Temporary, default-off diagnostic. The expected address must come from an
// operator-controlled source outside this request's forwarding headers.
function createProxyDiagnostic({ env = process.env, now = Date.now,
  readyState = () => mongoose.connection.readyState } = {}) {
  return function proxyDiagnostic(req, res, next) {
    if (req.method !== "GET" || env.PROXY_DIAGNOSTIC_ENABLED !== "true" || readyState() !== 1) return next();

    const token = env.PROXY_DIAGNOSTIC_TOKEN;
    const expectedIp = env.PROXY_DIAGNOSTIC_EXPECTED_CLIENT_IP;
    const expiry = env.PROXY_DIAGNOSTIC_EXPIRES_AT;
    const expiresAt = typeof expiry === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(expiry)
      ? Date.parse(expiry) : NaN;
    const remainingMs = expiresAt - now();
    if (!TOKEN_PATTERN.test(token || "") || net.isIP(expectedIp || "") === 0
      || expectedIp === SYNTHETIC_FORWARDED_IP
      || !Number.isFinite(remainingMs) || remainingMs <= 0 || remainingMs > MAX_LIFETIME_MS) {
      return next();
    }

    const authorization = req.get("authorization");
    const suppliedToken = typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7) : "";
    if (!TOKEN_PATTERN.test(suppliedToken)
      || !crypto.timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(token))) return next();

    const clientIp = normalizedIp(req.ip);
    const expectedClientIp = normalizedIp(expectedIp);
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ status: "ok", proxyDiagnostic: {
      matchesExpectedClient: req.ip === expectedIp,
      matchesExpectedClientNormalized: clientIp !== null && clientIp === expectedClientIp,
      matchesSyntheticForwarded: req.ip === SYNTHETIC_FORWARDED_IP,
    } });
  };
}

module.exports = { createProxyDiagnostic };
