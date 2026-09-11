import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Seo from "../components/Seo";

function RequireAuth() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-700">
        Checking your session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== "user") {
    return <Navigate to="/login" replace />;
  }

  return <><Seo title="Your learning account" noIndex /><Outlet /></>;
}

export default RequireAuth;
