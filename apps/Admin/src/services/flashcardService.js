import { apiClient } from "../api/client";

const normalize = (card) => ({ ...card, id: card._id || card.id });
const makeFormData = (card) => {
  const data = new FormData();
  data.append("prompt", card.prompt.trim());
  data.append("answer", card.answer.trim());
  data.append("translation", card.translation.trim());
  data.append("category", card.category);
  data.append("isPublished", String(card.isPublished));
  if (card.imageFile) data.append("image", card.imageFile);
  return data;
};

export const fetchFlashcards = async () => (await apiClient.get("/flashcards/admin")).map(normalize);
export const createFlashcard = async (card) => normalize(await apiClient.post("/flashcards/admin", makeFormData(card)));
export const updateFlashcard = async (id, card) => normalize(await apiClient.put(`/flashcards/admin/${id}`, makeFormData(card)));
export const deleteFlashcard = (id) => apiClient.delete(`/flashcards/admin/${id}`);
export const fetchFlashcardCategories = () => apiClient.get("/flashcards/admin/categories");
export const createFlashcardCategory = (name) => apiClient.post("/flashcards/admin/categories", { name });
export const updateFlashcardCategory = (id, name) => apiClient.put(`/flashcards/admin/categories/${id}`, { name });
export const deleteFlashcardCategory = (id) => apiClient.delete(`/flashcards/admin/categories/${id}`);
