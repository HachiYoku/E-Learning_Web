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
    <div className="flex min-h-screen flex-col bg-[#FFF9EA] text-[#2D2E30]">
      <Navbar />

      <main className="relative isolate flex-1 overflow-hidden px-4 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20 lg:px-16">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#E9A9A0]/20 blur-3xl" aria-hidden="true" />
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Your learning space</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF1D0] text-[#C97112]"><Bell className="h-5 w-5" aria-hidden="true" /></span>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Notifications</h1>
              </div>
              <p className="mt-3 text-sm text-[#765F55] sm:text-base">Keep track of your courses, payments, and updates.</p>
            </div>

            {notifications.some((item) => !item.isRead) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E58C1A]/20 bg-[#FFFDF8] px-4 py-3 text-sm font-semibold text-[#C97112] shadow-sm transition hover:border-[#E58C1A]/40 hover:bg-[#FFF1D0]"
              >
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFilter === filter.key
                    ? "bg-[#2D2E30] text-white shadow-md shadow-[#2D2E30]/10"
                    : "bg-transparent text-[#765F55] hover:bg-[#FFF1D0] hover:text-[#C97112]"
                }`}
              >
                {filter.label}
              </button>
            ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[1.75rem] border border-[#E58C1A]/15 bg-white/80 p-10 text-center text-[#765F55] shadow-[0_18px_40px_-34px_rgba(80,48,19,0.45)]">
              Loading your notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#E58C1A]/25 bg-white/70 p-10 text-center shadow-[0_18px_40px_-34px_rgba(80,48,19,0.4)] sm:p-14">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1D0] text-[#C97112]"><Bell className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="mt-5 text-xl font-bold">No notifications in this view</h2>
              <p className="mt-2 text-[#765F55]">Try another filter or check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => handleOpen(notification)}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left shadow-[0_18px_40px_-34px_rgba(80,48,19,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-30px_rgba(80,48,19,0.5)] sm:px-5 sm:py-4 ${
                    notification.isRead
                      ? "border-[#2D2E30]/10 bg-white/80"
                      : "border-[#E58C1A]/25 bg-[#FFFDF8]"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${
                        notification.isRead ? "bg-[#D9D2CB] ring-[#D9D2CB]/20" : "bg-[#E58C1A] ring-[#E58C1A]/15"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold tracking-tight sm:text-[17px]">{notification.title}</p>
                        {!notification.isRead && (
                          <span className="rounded-full bg-[#FFF1D0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#C97112]">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm leading-5 text-[#765F55]">{notification.message}</p>

                      <p className="mt-2 text-[11px] font-medium text-[#A09288]">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#C97112]" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Notifications;
