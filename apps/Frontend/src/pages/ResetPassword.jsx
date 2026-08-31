import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { resetPassword as resetPasswordRequest } from "../services/authService";

const inputClass = "mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 pr-12 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10";

function PasswordField({ label, value, onChange, visible, toggle, autoComplete }) {
  return <label className="block text-sm font-bold text-[#2D2E30]">{label}<div className="relative"><input type={visible ? "text" : "password"} value={value} onChange={onChange} required minLength="12" autoComplete={autoComplete} className={inputClass} placeholder="Enter your new password" /><button type="button" onClick={toggle} className="absolute bottom-3 right-3 text-[#765F55] hover:text-[#C97112]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>;
}

function ResetPassword() {
  const { token } = useParams(); const navigate = useNavigate(); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [showConfirmation, setShowConfirmation] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [successMessage, setSuccessMessage] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault(); setError(""); setSuccessMessage("");
    if (!token) return setError("Reset token is missing.");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/.test(password)) return setError("Use 12+ characters with uppercase, lowercase, and a number.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try { const response = await resetPasswordRequest(token, { password }); setSuccessMessage(response.message || "Password reset successfully."); setTimeout(() => navigate("/login", { replace: true }), 1500); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Secure your account" title={<>Create a new <span className="text-[#E58C1A]">password.</span></>} description="Choose a strong password that you have not used elsewhere." footer={<>Back to <Link to="/login" className="font-bold text-[#C97112] hover:underline">login</Link></>}>
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-[#7AB589]/30 bg-[#EDF8EE] px-4 py-3 text-sm text-[#246B35]">{successMessage}</p> : null}
      <PasswordField label="New password" value={password} onChange={(event) => setPassword(event.target.value)} visible={showPassword} toggle={() => setShowPassword((current) => !current)} autoComplete="new-password" />
      <PasswordField label="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} visible={showConfirmation} toggle={() => setShowConfirmation((current) => !current)} autoComplete="new-password" />
      <p className="-mt-2 text-xs font-medium text-[#765F55]">Use 12+ characters with uppercase, lowercase, and a number.</p>
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:opacity-70">{loading ? "Resetting password..." : "Reset password"}</button>
    </form>
  </AuthShell>;
}

export default ResetPassword;
