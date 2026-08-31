import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { register as registerRequest } from "../services/authService";

const inputClass = "mt-2 w-full rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-3 text-[#2D2E30] outline-none transition placeholder:text-[#9B867C] focus:border-[#E58C1A] focus:ring-4 focus:ring-[#E58C1A]/10";

function Register() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const navigate = useNavigate();
  const handleRegister = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { const response = await registerRequest({ name, email, password }); navigate("/login", { state: { registrationEmail: email, registrationMessage: response.message || "Registration successful. Please check your email to verify your account.", emailSent: response.emailSent !== false } }); }
    catch (registerError) { setError(registerError.message); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Start learning" title={<>Create your <span className="text-[#E58C1A]">account.</span></>} description="A few details and you’ll be ready to learn Thai with confidence." asideTitle="A warmer way to learn Thai." footer={<>Already have an account? <Link to="/login" className="font-bold text-[#C97112] hover:underline">Log in</Link></>}>
    <form onSubmit={handleRegister} className="space-y-5">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm font-bold text-[#2D2E30]">Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className={inputClass} placeholder="Your name" /></label>
      <label className="block text-sm font-bold text-[#2D2E30]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={inputClass} placeholder="you@example.com" /></label>
      <label className="block text-sm font-bold text-[#2D2E30]">Password<div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength="12" autoComplete="new-password" className={`${inputClass} pr-12`} placeholder="Create a secure password" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute bottom-3 right-3 text-[#765F55] hover:text-[#C97112]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div><span className="mt-2 block text-xs font-medium text-[#765F55]">12+ characters with uppercase, lowercase, and a number.</span></label>
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:-translate-y-0.5 hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-70">{loading ? "Creating your account..." : "Create account"}</button>
    </form>
  </AuthShell>;
}

export default Register;
