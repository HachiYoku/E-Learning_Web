import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { AdminBadgeProvider } from './contexts/AdminBadgeContext.jsx'

// Remove data created by the retired mock/localStorage authentication flow.
// The current session is restored only from the HttpOnly refresh cookie.
const LEGACY_AUTH_STORAGE_KEYS = [
  'currentUser', 'profile', 'users', 'user', 'userProfile', 'adminUser',
  'authUser', 'admin_auth_token', 'auth_token',
]

try {
  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  }
} catch {
  // Storage may be unavailable in privacy-restricted contexts; authentication
  // does not depend on browser-persistent storage.
}

// The admin is not a PWA. An older build registered a service worker on the
// local admin origin, which can serve stale HTML as manifest.json.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AdminBadgeProvider><App /></AdminBadgeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
