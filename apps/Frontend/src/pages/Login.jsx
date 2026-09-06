import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { resendVerification } from "../services/authService";

const inputClass = "mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10";

function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.registrationEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [loginErrorCode, setLoginErrorCode] = useState("");
  const [infoMessage, setInfoMessage] = useState(location.state?.registrationMessage || "");
  const { login, logout, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const redirectTo = location.state?.from?.pathname || "/";
  const canResendVerification = location.state?.emailSent === false || loginErrorCode === "EMAIL_UNVERIFIED";
  const accountIsDeactivated = loginErrorCode === "ACCOUNT_DEACTIVATED";

  const handleLogin = async (event) => {
    event.preventDefault(); setLoading(true); setError(""); setLoginErrorCode(""); setInfoMessage("");
    try {
      const user = await login({ email, password });
      if (user.role !== "user") { logout(); setError("This login page is for student accounts. Please use the admin site for admin access."); return; }
      showToast({ title: "Login successful", message: "Welcome back! You are now signed in.", type: "success" });
      navigate(redirectTo, { replace: true });
    } catch (loginError) { setError(loginError.message); setLoginErrorCode(loginError.data?.code || ""); showToast({ title: "Login failed", message: loginError.message, type: "error" }); }
    finally { setLoading(false); }
  };

  const handleResendVerification = async () => {
    if (!email) { setError("Please enter your email first."); return; }
    setResending(true); setError("");
    try { const response = await resendVerification({ email }); setInfoMessage(response.message || "Verification email sent. Please check your inbox."); }
    catch (resendError) { setError(resendError.message); }
    finally { setResending(false); }
  };

  useEffect(() => { if (isAuthenticated) navigate(redirectTo, { replace: true }); }, [isAuthenticated, navigate, redirectTo]);
  useEffect(() => { if (location.state?.registrationMessage) setInfoMessage(location.state.registrationMessage); }, [location.state]);

  return <AuthShell title={<>Welcome back to <span className="text-[#E58C1A]">Arun Thai.</span></>} description="Continue your Thai learning journey from exactly where you left off." footer={<>New to Arun Thai? <Link to="/register" className="font-bold text-[#C97112] hover:underline">Create an account</Link></>}>
    <form onSubmit={handleLogin} className="space-y-5">
      {infoMessage ? <p className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]">{infoMessage}</p> : null}
      {accountIsDeactivated ? <div className="rounded-xl border border-[#E58C1A]/25 bg-[#FFF9EA] px-4 py-3.5 text-sm text-[#765F55]"><p className="font-bold text-[#2D2E30]">Your account is currently paused.</p><p className="mt-1 leading-5">An administrator has temporarily deactivated this account. If you think this is a mistake, please contact <a href="mailto:arunthaiedu@gmail.com" className="font-bold text-[#C97112] hover:underline">Arun Thai support</a>.</p></div> : error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm font-bold text-[#2D2E30]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={inputClass} placeholder="you@example.com" /></label>
      <label className="block text-sm font-bold text-[#2D2E30]">Password<div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className={`${inputClass} pr-12`} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute bottom-3 right-3 text-[#765F55] hover:text-[#C97112]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <div className="text-right"><Link to="/forgot-password" className="text-sm font-semibold text-[#C97112] hover:underline">Forgot password?</Link></div>
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70">{loading ? "Logging in..." : "Log in"}</button>
      {canResendVerification ? <button type="button" onClick={handleResendVerification} disabled={resending} className="w-full rounded-xl border border-[#E58C1A]/25 bg-[#FFF9EA] px-5 py-3 text-sm font-bold text-[#C97112] transition hover:bg-[#FFF1D0] disabled:opacity-70">{resending ? "Sending verification email..." : "Resend verification email"}</button> : null}
    </form>
  </AuthShell>;
}

export default Login;
