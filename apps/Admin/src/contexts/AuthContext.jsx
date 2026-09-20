import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  updateCurrentUserProfile,
} from "../services/authService";
import {
  clearToken,
  getToken,
  setToken as persistToken,
} from "../api/tokenStorage";
import { refreshAccessToken, SESSION_EXPIRED_EVENT } from "../api/client";
import SessionExpiredModal from "../components/SessionExpiredModal";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");

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

  function clearLocalSession() {
    clearToken();
    setTokenState(null);
    setUser(null);
  }

  async function logout() {
    clearLocalSession();
    try {
      await logoutRequest();
    } catch {
      // The browser no longer has an access token even if the network failed.
    }
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
      clearLocalSession,
    }),
    [token, user, isBootstrapping]
  );

  const continueToLogin = () => {
    setSessionExpiredMessage("");
    window.location.assign("/login");
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal isOpen={Boolean(sessionExpiredMessage)} message={sessionExpiredMessage} onContinue={continueToLogin} />
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
