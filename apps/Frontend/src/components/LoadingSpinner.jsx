function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white px-6 py-10 text-center text-gray-600 shadow-sm">
      <div className="h-12 w-12 rounded-full border-4 border-[#F8B2C0] border-t-transparent animate-spin" />
      <p className="text-sm sm:text-base font-medium">{message}</p>
    </div>
  )
}

export default LoadingSpinner
