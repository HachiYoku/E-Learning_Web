export const feedbackStatusLabels = {
  private: "Private",
  awaiting_review: "Awaiting website review",
  published: "Published",
  not_selected: "Not selected for website",
  withdrawn: "Sharing withdrawn",
};

export function feedbackStatus(feedback) {
  if (feedback?.publicationConsent?.status === "withdrawn" || feedback?.publication?.status === "withdrawn") return "withdrawn";
  if (feedback?.publication?.status === "published") return "published";
  if (feedback?.publication?.status === "not_selected") return "not_selected";
  if (feedback?.publicationConsent?.status === "permitted" || feedback?.publication?.status === "awaiting_review") return "awaiting_review";
  return "private";
}

export function feedbackStatusLabel(feedback) {
  return feedbackStatusLabels[feedbackStatus(feedback)];
}
