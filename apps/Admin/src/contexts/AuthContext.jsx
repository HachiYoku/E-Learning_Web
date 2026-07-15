import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  getCurrentUser,
  login as loginRequest,
  updateCurrentUserProfile,
} from "../services/authService";
import {
  clearToken,
  getToken,
  setToken as persistToken,
} from "../api/tokenStorage";
import { SESSION_EXPIRED_EVENT } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(getToken()));
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsBootstrapping(false);
      return;
    }

    let isMounted = true;

    async function bootstrapUser() {
      try {
        const response = await getCurrentUser();
        if (isMounted) {
          setUser(response.user);
        }
      } catch {
        clearToken();
        if (isMounted) {
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrapUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    function handleSessionExpired(event) {
      const message =
        event?.detail?.message || "Your session expired. Please log in again.";

      clearToken();
      setTokenState(null);
      setUser(null);
      setIsBootstrapping(false);
      setSessionExpiredMessage(message);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  async function login(credentials) {
    const response = await loginRequest(credentials);
    storeToken(response.accessToken);
    const me = await getCurrentUser();
    setUser(me.user);
    return me.user;
  }

  async function updateProfile(profile) {
    const updatedUser = await updateCurrentUserProfile(profile);
    setUser(updatedUser);
    return updatedUser;
  }

  function storeToken(nextToken) {
    setTokenState(nextToken);

    if (nextToken) {
      persistToken(nextToken);
      return;
    }

    clearToken();
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      login,
      updateProfile,
      logout,
    }),
    [token, user, isBootstrapping]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}

      {sessionExpiredMessage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative bg-gradient-to-r from-rose-50 via-pink-50 to-blue-50 px-6 pb-5 pt-6">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8B2C0] text-gray-900 shadow-sm">
                <ShieldAlert size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Session Expired
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {sessionExpiredMessage}
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
                <p className="text-sm text-amber-800">
                  For security, your admin session was closed. Please sign in
                  again to continue.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSessionExpiredMessage("")}
                className="w-full rounded-2xl bg-[#F8B2C0] px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-[#F8C2C0]"
              >
                Go To Login
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
