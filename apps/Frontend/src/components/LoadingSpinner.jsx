function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-center rounded-[1.75rem] border border-[#2D2E30]/10 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-34px_rgba(80,48,19,0.35)]" role="status" aria-live="polite">
      <div className="flex flex-col items-center">
        <div className="relative flex h-14 w-14 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-2 border-[#F8C56A]/35" />
          <div className="absolute inset-1.5 rounded-full border-2 border-[#E58C1A] border-t-transparent animate-spin" />
          <div className="h-2 w-2 rounded-full bg-[#F8C56A]" />
        </div>
        <p className="mt-5 text-sm font-medium text-[#765F55]">{message}</p>
      </div>
    </div>
  )
}

export default LoadingSpinner
