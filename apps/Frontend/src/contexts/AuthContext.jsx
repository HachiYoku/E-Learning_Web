import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { confirmOwnAccountDeletion as confirmOwnAccountDeletionRequest, deleteOwnAccount as deleteOwnAccountRequest, getCurrentUser, login as loginRequest, logout as logoutRequest } from "../services/authService";
import {
  clearToken,
  getToken,
  setToken as persistToken,
} from "../api/tokenStorage";
import { refreshAccessToken, SESSION_EXPIRED_EVENT } from "../api/client";
import SessionExpiredModal from "../components/SessionExpiredModal";

const AuthContext = createContext(null);

function clearStudentSessionData(userId) {
  if (!userId || typeof window === "undefined") return;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(`quiz-draft:${userId}:`)) localStorage.removeItem(key);
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function bootstrapUser() {
      try {
        const restoredToken = getToken() || await refreshAccessToken();
        if (!isMounted) return;
        setTokenState(restoredToken);
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
  }, []);

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

  const storeToken = useCallback((nextToken) => {
    setTokenState(nextToken);

    if (nextToken) {
      persistToken(nextToken);
      return;
    }

    clearToken();
  }, []);

  const clearLocalSession = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    storeToken(response.accessToken);
    const me = await getCurrentUser();
    setUser(me.user);
    return me.user;
  }, [storeToken]);

  const logout = useCallback(async () => {
    clearLocalSession();
    try {
      await logoutRequest();
    } catch {
      // Local state is still cleared. The server cookie expires naturally if
      // the network is unavailable, and is revoked on the next successful logout.
    }
  }, [clearLocalSession]);

  const confirmAccountDeletion = useCallback(async (currentPassword) => {
    const response = await confirmOwnAccountDeletionRequest(currentPassword);
    return response.deletionConfirmationToken;
  }, []);

  const deleteAccount = useCallback(async (deletionConfirmationToken) => {
    const deletedUserId = user?.id;
    await deleteOwnAccountRequest(deletionConfirmationToken);
    clearStudentSessionData(deletedUserId);
    clearLocalSession();
    navigate("/", { replace: true });
  }, [clearLocalSession, navigate, user?.id]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      login,
      logout,
      confirmAccountDeletion,
      deleteAccount,
      clearLocalSession,
      setUser,
    }),
    [token, user, isBootstrapping, login, logout, confirmAccountDeletion, deleteAccount, clearLocalSession]
  );

  const handleLoginRedirect = () => {
    setSessionExpiredMessage("");
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal
        isOpen={Boolean(sessionExpiredMessage)}
        message={sessionExpiredMessage}
        onLoginClick={handleLoginRedirect}
      />
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
