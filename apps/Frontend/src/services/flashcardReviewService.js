import { apiClient } from "../api/client";

export const fetchPersonalReviewSummary = () => apiClient.get("/flashcard-reviews/summary?scope=personal");

export const fetchDuePersonalFlashcards = (limit = 20) => apiClient.get(`/flashcard-reviews/due?scope=personal&limit=${limit}`);

export const ratePersonalFlashcard = (cardId, rating) => apiClient.post("/flashcard-reviews/rate", {
  cardType: "personal",
  cardId,
  rating,
});
