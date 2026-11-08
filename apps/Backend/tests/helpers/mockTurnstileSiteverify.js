// Loaded only by the auth integration test's child process. Production never loads this file.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    return realFetch(url, options);
  }
  const params = new URLSearchParams(options.body);
  const token = params.get("response");
  if (token === "service-error") return new Response("", { status: 503 });
  const valid = params.get("secret") === "test-only-turnstile-secret" && token?.startsWith("valid-");
  const action = token === "valid-wrong-action" || token === "valid-forgot-wrong-action"
    ? "login"
    : token?.startsWith("valid-forgot-") ? "forgot_password" : "register";
  return new Response(JSON.stringify({
    success: Boolean(valid),
    action,
    hostname: token === "valid-wrong-host" || token === "valid-forgot-wrong-host" ? "attacker.example.test" : "student.example.test",
    "error-codes": valid ? [] : ["invalid-input-response"],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
