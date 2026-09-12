import { apiClient } from "../api/client"

export const createSupportTicket = (values) => apiClient.post("/support-tickets", values)
export const fetchMySupportTickets = () => apiClient.get("/support-tickets/mine")
