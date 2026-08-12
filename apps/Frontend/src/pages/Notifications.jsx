import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "course", label: "Course" },
  { key: "payment", label: "Payment" },
];

function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleOpen = async (notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification._id);
      } catch (error) {
        console.error("Failed to mark notification as read", error);
      }
    }

    if (notification.link) {
      navigate(notification.link);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item._id === notification._id ? { ...item, isRead: true } : item
      )
    );
    setUnreadCount((count) => Math.max(count - 1, 0));
  };

  const handleMarkAllRead = async () => {
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

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "course") return notification.type === "course" || notification.type === "enrollment";
    if (activeFilter === "payment") return notification.type === "payment";
    return true;
  });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="px-4 py-8 sm:px-6 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Account</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Notifications</h1>
            </div>

            {notifications.some((item) => !item.isRead) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === filter.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <Bell className="mx-auto h-12 w-12 text-gray-300" />
              <h2 className="mt-4 text-xl font-semibold text-gray-700">No notifications in this view</h2>
              <p className="mt-2 text-gray-500">Try another filter or check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => handleOpen(notification)}
                  className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
                    notification.isRead
                      ? "border-gray-200 bg-white"
                      : "border-blue-200 bg-blue-50/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-1.5 h-3 w-3 rounded-full ${
                        notification.isRead ? "bg-gray-300" : "bg-blue-500"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold text-gray-900">{notification.title}</p>
                        {!notification.isRead && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-gray-600">{notification.message}</p>

                      <p className="mt-3 text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Notifications;
