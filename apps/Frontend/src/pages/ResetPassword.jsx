import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPassword as resetPasswordRequest } from "../services/authService";

const logo = "/login/Login-logo.png";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await resetPasswordRequest(token, { password });
      setSuccessMessage(
        response.message || "Password has been reset successfully."
      );
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
        <div className="hidden md:flex justify-center">
          <div className="relative">
            <img
              src="/login/Login-bg.jpg"
              alt="English Kafe"
              className="w-full object-cover rounded-2xl"
              style={{ height: "500px" }}
            />
            <div className="absolute inset-0 bg-black/30 rounded-2xl"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={logo}
                alt="English Kafe Logo"
                className="w-25  sm:w-20 md:w-23 lg:w-25 h-25 sm:h-20 md:h-23 lg:h-25 object-contain drop-shadow-lg"
              />
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-gray-900 mb-2 leading-tight">
            Create a new password
          </h2>

          <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">
            Enter your new password to finish resetting your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Enter your new password"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Confirm your new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-normal py-2 sm:py-3 rounded-lg transition-opacity text-sm sm:text-base disabled:opacity-70"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs sm:text-sm mt-4 sm:mt-6">
            Back to <Link to="/login" className="text-gray-900 font-semibold hover:underline">login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
