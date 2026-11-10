# Student account and contact Turnstile setup

Turnstile protects `POST /auth/register`, `POST /auth/forgot-password`, and `POST /contacts`. The browser widget is not a security boundary: Backend validates every token with Cloudflare Siteverify before looking up or creating a user, before password-reset email work, or before contact persistence and optional marketing-confirmation email work. Missing configuration, invalid tokens, and verification outages fail closed. Existing registration, password-reset, and contact rate limits remain in place.

## Environment configuration

- Frontend/Vercel: `VITE_TURNSTILE_SITE_KEY` is the **public** site key for that environment. Vite embeds it at build time, so rebuild after changing it.
- Backend/Render: `TURNSTILE_SECRET_KEY` is the **private** secret paired with that site key. Never put it in a `VITE_` variable, repository file, or browser response.
- Backend/Render: `TURNSTILE_ALLOWED_HOSTNAMES` is a comma-separated list of exact hostnames accepted from Siteverify. Production should contain `arunthaiedu.com` only unless another production registration hostname is confirmed. Do not include a scheme, port, wildcard, or arbitrary `vercel.app` host.

In Cloudflare, verify the existing production Managed-mode registration widget is authorized for the actual Frontend hostname. Keep production keys separate from testing keys. For local development, use Cloudflare's official test site key and matching test secret, or a dedicated development widget. Do not use production credentials locally. Configure a testing widget for the stable testing Frontend hostname; preview deployments need their own deliberate hostname/test-key approach. Production secrets must not be replaced with test secrets.

Turnstile needs `https://challenges.cloudflare.com` in the Frontend `script-src` and `frame-src` CSP directives. The Backend calls Siteverify over HTTPS; browser CORS does not grant or replace that validation. The widget uses action `register`, `forgot_password`, or `contact`; Backend checks the exact action and configured hostname. Tokens expire and can be used once, so a failed request resets the widget for a fresh token.

If the secret may be compromised, rotate it in Cloudflare, update only the corresponding Render environment, redeploy Backend, and verify registration. Never log or transmit the secret in support messages.

## Rollout order

1. Before either deployment, configure the production Cloudflare widget for `arunthaiedu.com`, set the paired public site key in production Vercel, and set the private secret plus exact hostname allowlist in production Render. Configure testing separately and verify there first.
2. Coordinate the releases in a short window: deploy Backend enforcement first, then immediately deploy the configured Frontend. The old forms cannot submit during that interval. A Frontend-first release would leave the old Backend accepting unverified requests, so it is not the preferred sequence. There is intentionally no production bypass or fail-open compatibility path. Schedule/communicate the brief potential interruption rather than silently weakening protection.
3. After both deployments, test registration, password reset, and contact submission on the production hostname, confirm the widget loads under CSP, and verify the generic reset response does not reveal account existence. Do not deploy or change dashboard settings as part of code review.

If Cloudflare cannot be reached, the secret is missing, or the widget cannot load, registration, password-reset, and contact requests remain unavailable until configuration/service is restored. Existing login remains unchanged. Verify Render's `TRUST_PROXY` setting separately so existing IP-based rate limits identify clients as intended; do not change that setting as part of this feature.
