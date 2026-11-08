import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import RegistrationTurnstile from "../components/RegistrationTurnstile";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [successMessage, setSuccessMessage] = useState(""); const [turnstileToken, setTurnstileToken] = useState(""); const [verificationError, setVerificationError] = useState("");
  const navigate = useNavigate();
  const turnstileControl = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const handleResetPassword = async (event) => {
    event.preventDefault(); setError(""); setSuccessMessage("");
    if (!turnstileToken || !siteKey) {
      setVerificationError("Complete security verification before requesting a reset link.");
      return;
    }
    setLoading(true);
    try {
      const response = await forgotPasswordRequest({ email, turnstileToken });
      setSuccessMessage(response.message || "If an account exists, a reset link has been sent.");
      turnstileControl.current?.reset(); setTurnstileToken("");
      setTimeout(() => navigate("/login"), 1800);
    }
    catch (requestError) { setError(requestError.message); turnstileControl.current?.reset(); setTurnstileToken(""); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Account recovery" title={<>Reset your <span className="text-[#E58C1A]">password.</span></>} description="Enter your account email and we’ll send a secure link to set a new password." footer={<>Remembered it? <Link to="/login" className="font-bold text-[#C97112] hover:underline">Back to login</Link></>}>
    <form onSubmit={handleResetPassword} className="space-y-5">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]">{successMessage}</p> : null}
      <label className="block text-sm font-bold text-[#2D2E30]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-base text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10 sm:text-sm" placeholder="you@example.com" /></label>
      {verificationError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{verificationError}</p> : null}
      {siteKey ? <RegistrationTurnstile siteKey={siteKey} action="forgot_password" controlRef={turnstileControl} onToken={(token) => { setTurnstileToken(token); if (token) setVerificationError(""); }} onError={setVerificationError} /> : <p role="alert" className="text-sm text-red-700">Security verification is unavailable. Please try again later.</p>}
      <button type="submit" disabled={loading || !turnstileToken || !siteKey} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70">{loading ? "Sending link..." : "Send reset link"}</button>
    </form>
  </AuthShell>;
}

export default ForgotPassword;
