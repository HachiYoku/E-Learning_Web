import { apiClient } from "../api/client";

const cleanText = (value) => String(value || "").trim();

export const fetchPersonalFlashcardDecks = () => apiClient.get("/my-flashcards/decks");
export const createPersonalFlashcardDeck = (name) => apiClient.post("/my-flashcards/decks", { name: cleanText(name) });
export const updatePersonalFlashcardDeck = (deckId, name) => apiClient.put(`/my-flashcards/decks/${deckId}`, { name: cleanText(name) });
export const deletePersonalFlashcardDeck = (deckId) => apiClient.delete(`/my-flashcards/decks/${deckId}`);
export const fetchPersonalFlashcards = (deckId) => apiClient.get(`/my-flashcards/decks/${deckId}/cards`);
export const createPersonalFlashcard = (deckId, { prompt, answer }) => apiClient.post(`/my-flashcards/decks/${deckId}/cards`, { prompt: cleanText(prompt), answer: cleanText(answer) });
export const updatePersonalFlashcard = (deckId, cardId, { prompt, answer }) => apiClient.put(`/my-flashcards/decks/${deckId}/cards/${cardId}`, { prompt: cleanText(prompt), answer: cleanText(answer) });
export const deletePersonalFlashcard = (deckId, cardId) => apiClient.delete(`/my-flashcards/decks/${deckId}/cards/${cardId}`);
