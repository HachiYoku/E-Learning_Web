import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { resendVerification } from '../services/authService'

const logo = '/Nav/Logo.PNG'

function VerificationHelp() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const verificationMessage = searchParams.get('message')
  const verificationEmail = searchParams.get('email')
  const [email, setEmail] = useState(verificationEmail || '')
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const handleResendVerification = async (e) => {
    e.preventDefault()

    if (!email) {
      setError('Please enter your email first.')
      return
    }

    setResending(true)
    setError('')
    setInfoMessage('')

    try {
      const response = await resendVerification({ email })
      setInfoMessage(response.message || 'Verification email sent. Please check your inbox.')
    } catch (resendError) {
      setError(resendError.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
        <div className="hidden md:flex justify-center">
          <div className="relative">
            <img
              src="/login/young-students-learning-together-group-study.jpg"
              alt="English Kafé"
              className="w-full object-cover rounded-2xl"
              style={{ height: '500px' }}
            />
            <div className="absolute inset-0 bg-black/30 rounded-2xl"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={logo}
                alt="English Kafé Logo"
                className="w-52 sm:w-60 md:w-64 lg:w-70 h-52 sm:h-60 md:h-64 lg:h-70 object-contain drop-shadow-lg"
              />
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-gray-900 mb-2 leading-tight">
            Verification help
          </h2>

          <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">
            Your old verification link may be expired or invalid. Enter your email and we will send you a new one.
          </p>

          {verificationMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {verificationMessage}
            </div>
          ) : null}

          {infoMessage ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 mb-4">
              {infoMessage}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleResendVerification} className="space-y-4 sm:space-y-6">
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

            <button
              type="submit"
              disabled={resending}
              className="w-full bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-normal py-2 sm:py-3 rounded-lg transition-opacity text-sm sm:text-base"
            >
              {resending ? 'Sending verification email...' : 'Send new verification link'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs sm:text-sm mt-4 sm:mt-6">
            Ready to sign in? <Link to="/login" className="text-gray-900 font-semibold hover:underline">Go to login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default VerificationHelp
