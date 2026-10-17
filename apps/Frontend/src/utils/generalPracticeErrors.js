export function generalPracticeErrorMessage(error) {
  if (error?.status === 401) return "Your session has expired. Please sign in again."
  if (error?.status === 404) return "This quiz is no longer available."
  if (error?.status === 409) return "This quiz session has expired or is no longer available. Your answers were not submitted."
  if (error?.status === 429) {
    const seconds = Number(error.retryAfter)
    return Number.isSafeInteger(seconds) && seconds > 0
      ? `Too many quiz requests. Please try again in ${seconds} seconds.`
      : "Too many quiz requests. Please try again later."
  }
  if (error?.status === 503) return "General Practice is temporarily unavailable. Please try again later."
  return "The request could not be completed. Check your connection and try again."
}

export function guestGeneralPracticeErrorMessage(error) {
  if (error?.status === 401) return "This guest session is no longer available in this browser. Start a new quiz when ready."
  if (error?.status === 404) return "This quiz or temporary result is no longer available."
  return generalPracticeErrorMessage(error)
}
