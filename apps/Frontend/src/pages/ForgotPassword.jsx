import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const handleResetPassword = async (event) => {
    event.preventDefault(); setLoading(true); setError(""); setSuccessMessage("");
    try { const response = await forgotPasswordRequest({ email }); setSuccessMessage(response.message || "If an account exists, a reset link has been sent."); setTimeout(() => navigate("/login"), 1800); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Account recovery" title={<>Reset your <span className="text-[#E58C1A]">password.</span></>} description="Enter your account email and we’ll send a secure link to set a new password." footer={<>Remembered it? <Link to="/login" className="font-bold text-[#C97112] hover:underline">Back to login</Link></>}>
    <form onSubmit={handleResetPassword} className="space-y-5">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]">{successMessage}</p> : null}
      <label className="block text-sm font-bold text-[#2D2E30]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10" placeholder="you@example.com" /></label>
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:opacity-70">{loading ? "Sending link..." : "Send reset link"}</button>
    </form>
  </AuthShell>;
}

export default ForgotPassword;
