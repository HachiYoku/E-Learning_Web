import { apiClient } from "../api/client";

export function fetchFlashcards() {
  return apiClient.get("/flashcards");
}
