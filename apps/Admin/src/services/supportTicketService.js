import { apiClient } from "../api/client";
export const fetchSupportTickets = () => apiClient.get("/support-tickets");
export const updateSupportTicketStatus = (id, status) => apiClient.patch(`/support-tickets/${id}/status`, { status });
export const replyToSupportTicket = (id, message) => apiClient.post(`/support-tickets/${id}/replies`, { message });
