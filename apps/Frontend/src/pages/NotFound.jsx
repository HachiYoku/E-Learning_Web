import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-blue-50">
      <Navbar />
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-400">404 Error</p>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">Page doesn&apos;t exist</h1>
          <p className="mt-3 text-sm text-gray-600 sm:text-base">
            The page you entered could not be found. Please return to the home page.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-8 rounded-xl bg-[#F8B2C0] px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-[#F8C2C0] sm:text-base"
          >
            Go To Home
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default NotFound
