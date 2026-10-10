const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const REGISTRATION_ACTION = "register";
const VERIFICATION_TIMEOUT_MS = 5000;

function allowedHostnames(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const hostnames = value.split(",").map((hostname) => hostname.trim().toLowerCase());
  if (hostnames.some((hostname) => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(hostname))) {
    return null;
  }
  return new Set(hostnames);
}

async function verifyRegistrationTurnstile(token, {
  secretKey = process.env.TURNSTILE_SECRET_KEY,
  hostnameConfig = process.env.TURNSTILE_ALLOWED_HOSTNAMES,
  fetchImpl = fetch,
} = {}) {
  const hostnames = allowedHostnames(hostnameConfig);
  if (!secretKey || !hostnames) return { ok: false, reason: "unavailable" };
  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(VERIFICATION_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };

    const result = await response.json();
    if (result?.success !== true) {
      const unavailable = result?.["error-codes"]?.includes("internal-error");
      return { ok: false, reason: unavailable ? "unavailable" : "invalid" };
    }
    if (result.action !== REGISTRATION_ACTION || !hostnames.has(result.hostname?.toLowerCase())) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

module.exports = { verifyRegistrationTurnstile };
