import { createContext, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = ({ title, message, type = "info" }) => {
    const id = Date.now() + Math.random();
    const toast = { id, title, message, type };

    setToasts((current) => [...current, toast]);

    window.setTimeout(() => {
      dismissToast(id);
    }, 3500);
  };

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full">
                {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {toast.type === "error" && <AlertCircle className="h-5 w-5 text-red-600" />}
                {toast.type === "info" && <Info className="h-5 w-5 text-blue-600" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{toast.title}</p>
                {toast.message && (
                  <p className="mt-1 text-sm text-gray-600">{toast.message}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
