import { apiClient } from "../api/client";

export const ratePersonalFlashcard = (cardId, rating) => apiClient.post("/flashcard-reviews/rate", {
  cardType: "personal",
  cardId,
  rating,
});
