import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { fetchPendingPaymentCount } from "../services/paymentService";
import { fetchActionableSupportCount } from "../services/supportTicketService";
const Context = createContext(null);
export function AdminBadgeProvider({ children }) {
  const { isAuthenticated, isBootstrapping, token, user } = useAuth(); const [badges, setBadges] = useState({ payments: 0, support: 0 }); const inFlight = useRef(null);
  const refresh = useCallback(() => { if (inFlight.current) return inFlight.current; inFlight.current = Promise.all([fetchPendingPaymentCount(), fetchActionableSupportCount()]).then(([payments, support]) => setBadges({ payments: payments.count || 0, support: support.count || 0 })).catch(() => undefined).finally(() => { inFlight.current = null; }); return inFlight.current; }, []);
  useEffect(() => { if (isBootstrapping || !isAuthenticated || user?.role !== "admin" || !token) { setBadges({ payments: 0, support: 0 }); return; } refresh(); const socket = io(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:3000", { auth: { token }, withCredentials: true }); socket.on("connect", refresh); socket.on("admin:payment-updated", refresh); socket.on("admin:support-updated", refresh); return () => socket.disconnect(); }, [isAuthenticated, isBootstrapping, token, user?.role, refresh]);
  return <Context.Provider value={{ badges }}>{children}</Context.Provider>;
}
export function useAdminBadges() { const value = useContext(Context); if (!value) throw new Error("Admin badge context is missing"); return value; }
