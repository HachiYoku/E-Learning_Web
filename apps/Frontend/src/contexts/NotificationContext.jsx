import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!isAuthenticated || !user?.id) return;

    try {
      setLoading(true);
      const response = await getNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      return;
    }

    fetchNotifications();

    const refreshInterval = setInterval(() => {
      fetchNotifications();
    }, 15000);

    const handleRefresh = () => fetchNotifications();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotifications();
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("notification:refresh", handleRefresh);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("notification:refresh", handleRefresh);
    };
  }, [isAuthenticated, user?.id]);

  const markAsRead = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
      setUnreadCount((count) => Math.max(count - 1, 0));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isOpen,
      setIsOpen,
      loading,
      fetchNotifications,
      markAsRead,
      markAllRead,
    }),
    [notifications, unreadCount, isOpen, loading]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }

  return context;
}
