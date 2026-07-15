import { useNavigate } from 'react-router-dom'

function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-400">404 Error</p>
        <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">Page doesn&apos;t exist</h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          The page you entered could not be found. Please return to the admin home page.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-8 rounded-xl bg-pink-300 px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-pink-400 sm:text-base"
        >
          Go To Home
        </button>
      </div>
    </div>
  )
}

export default NotFound
