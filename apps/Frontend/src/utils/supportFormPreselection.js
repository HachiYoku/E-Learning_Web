export const supportSubjectsByCategory = {
  course: ["Course access", "Lesson progress", "Course content", "Certificate question"],
  payment: ["Payment issue", "Order status", "Refund request", "Promo code problem"],
  technical: ["Cannot sign in", "Website issue", "Video or audio problem", "Other technical problem"],
  learning: ["Question about a lesson", "Practice activity question", "Learning recommendation", "Other learning question"],
  general: ["General question", "Account question", "Feedback", "Other request"],
}

export const defaultSupportForm = () => ({
  category: "general",
  subject: supportSubjectsByCategory.general[0],
  message: "",
})

export function supportFormPreselection(searchParams) {
  const category = searchParams.get("category")
  const subject = searchParams.get("subject")

  if (!supportSubjectsByCategory[category]?.includes(subject)) return null

  return { category, subject, message: "" }
}

export function paymentSupportPath(subject) {
  return `/app/support?${new URLSearchParams({ category: "payment", subject })}`
}
