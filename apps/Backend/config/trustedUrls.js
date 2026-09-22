const LOCAL_BACKEND_URL = "http://localhost:3000";
const LOCAL_FRONTEND_URL = "http://localhost:5173";

function normalizeTrustedUrl(name, value, { production, required, fallback } = {}) {
  const candidate = String(value || "").trim() || fallback;

  if (!candidate) {
    if (required) throw new Error(`${name} must be explicitly configured in production.`);
    return null;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  if (production && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an origin without credentials, a path, query parameters, or a fragment.`);
  }

  return parsed.origin;
}

function getTrustedUrls(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const frontendValue = production
    ? env.FRONTEND_URL_PROD || env.FRONTEND_URL
    : env.FRONTEND_URL_LOCAL || env.FRONTEND_URL || env.FRONTEND_URL_PROD;
  const adminValue = production
    ? env.ADMIN_URL_PROD || env.ADMIN_URL
    : env.ADMIN_URL_LOCAL || env.ADMIN_URL || env.ADMIN_URL_PROD;

  return {
    backendUrl: normalizeTrustedUrl('BACKEND_URL', env.BACKEND_URL, {
      production,
      required: production,
      fallback: production ? undefined : LOCAL_BACKEND_URL,
    }),
    frontendUrl: normalizeTrustedUrl('FRONTEND_URL_PROD (or FRONTEND_URL)', frontendValue, {
      production,
      required: production,
      fallback: production ? undefined : LOCAL_FRONTEND_URL,
    }),
    adminUrl: normalizeTrustedUrl('ADMIN_URL_PROD (or ADMIN_URL)', adminValue, {
      production,
      required: false,
    }),
  };
}

function buildTrustedUrl(baseUrl, pathname, searchParams = {}) {
  const url = new URL(pathname, `${baseUrl}/`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  return url.toString();
}

function buildVerificationUrl(token, env = process.env) {
  return buildTrustedUrl(getTrustedUrls(env).backendUrl, '/auth/verify-email', { token });
}

function buildPasswordResetUrl(token, env = process.env) {
  return buildTrustedUrl(getTrustedUrls(env).frontendUrl, `/reset-password/${encodeURIComponent(token)}`);
}

module.exports = { getTrustedUrls, buildTrustedUrl, buildVerificationUrl, buildPasswordResetUrl };
