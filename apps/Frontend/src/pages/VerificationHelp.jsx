import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { resendVerification } from "../services/authService";

function VerificationHelp() {
  const location = useLocation(); const searchParams = new URLSearchParams(location.search); const verificationMessage = searchParams.get("message"); const verificationEmail = searchParams.get("email");
  const [email, setEmail] = useState(verificationEmail || ""); const [resending, setResending] = useState(false); const [error, setError] = useState(""); const [infoMessage, setInfoMessage] = useState("");
  const handleResendVerification = async (event) => {
    event.preventDefault(); if (!email) { setError("Please enter your email first."); return; }
    setResending(true); setError(""); setInfoMessage("");
    try { const response = await resendVerification({ email }); setInfoMessage(response.message || "Verification email sent. Please check your inbox."); }
    catch (resendError) { setError(resendError.message); }
    finally { setResending(false); }
  };
  return <AuthShell eyebrow="Account verification" title={<>Let’s verify your <span className="text-[#E58C1A]">email.</span></>} description="If your link has expired or gone missing, we can send a fresh verification email." footer={<>Ready to sign in? <Link to="/login" className="font-bold text-[#C97112] hover:underline">Go to login</Link></>}>
    <form onSubmit={handleResendVerification} className="space-y-5">
      {verificationMessage ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{verificationMessage}</p> : null}
      {infoMessage ? <p className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]">{infoMessage}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm font-bold text-[#2D2E30]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="you@example.com" /></label>
      <button type="submit" disabled={resending} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:opacity-70">{resending ? "Sending verification email..." : "Send verification link"}</button>
    </form>
  </AuthShell>;
}

export default VerificationHelp;
