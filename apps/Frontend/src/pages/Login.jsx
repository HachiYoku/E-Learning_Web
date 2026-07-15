import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { resendVerification } from '../services/authService'
const logo = '/login/Login-logo.png'

function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(
    location.state?.registrationEmail || ''
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState(location.state?.registrationMessage || '')
  const { login, logout, isAuthenticated } = useAuth()

  const redirectTo = location.state?.from?.pathname || '/'
  const canResendVerification =
    location.state?.emailSent === false ||
    error === 'Invalid email, password, or account status'

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfoMessage('')

    try {
      const user = await login({ email, password })

      if (user.role !== 'user') {
        logout()
        setError('This login page is for student accounts. Please use the admin site for admin access.')
        return
      }

      navigate(redirectTo, { replace: true })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email first.')
      return
    }

    setResending(true)
    setError('')

    try {
      const response = await resendVerification({ email })
      setInfoMessage(response.message || 'Verification email sent. Please check your inbox.')
    } catch (resendError) {
      setError(resendError.message)
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, navigate, redirectTo])

  useEffect(() => {
    if (location.state?.registrationMessage) {
      setInfoMessage(location.state.registrationMessage)
    }
  }, [location.state])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
        
        {/* Left Side - Logo and Image */}
        <div className="hidden md:flex justify-center">
          <div className="relative">
            <img 
              src="/login/Login-bg.jpg" 
              alt="English Kafé" 
              className="w-full object-cover rounded-2xl"
              style={{ height: '500px' }}
            />
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/30 rounded-2xl"></div>
            {/* Logo Badge */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img 
                src={logo} 
                alt="English Kafé Logo" 
                className="w-25  sm:w-20 md:w-23 lg:w-25 h-25 sm:h-20 md:h-23 lg:h-25 object-contain drop-shadow-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-gray-900 mb-2 leading-tight">
            Welcome back <br />to <span className="font-bold">Mind Ploy English !</span>
          </h2>
          
          <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">
            Please enter your details to log in
          </p>

          {canResendVerification ? (
            <p className="text-sm text-gray-600 mb-4 sm:mb-6">
              If you still need account access help, you can request a new verification email below.
            </p>
          ) : null}

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            {infoMessage ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {infoMessage}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {/* Email Input */}
            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 pr-14 bg-blue-50 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:border-blue-400 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-gray-700 text-xs sm:text-sm hover:text-gray-900 transition-colors">
                Forgot Password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-normal py-2 sm:py-3 rounded-lg transition-opacity text-sm sm:text-base"
              
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            {canResendVerification ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-normal py-2 sm:py-3 rounded-lg transition-opacity text-sm sm:text-base"
              >
                {resending ? 'Sending verification email...' : 'Resend verification email'}
              </button>
            ) : null}
          </form>

          {/* Register Link */}
          <p className="text-center text-gray-600 text-xs sm:text-sm mt-4 sm:mt-6">
            Don't have account? <Link to="/register" className="text-gray-900 font-semibold hover:underline">register here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
