import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter as Router } from "react-router-dom"
import App from "./App.jsx"
import "./index.css"
import { AuthProvider } from "./contexts/AuthContext.jsx"
import { NotificationProvider } from "./contexts/NotificationContext.jsx"
import { ToastProvider } from "./contexts/ToastContext.jsx"
import { CatalogueCurrencyProvider } from "./contexts/CatalogueCurrencyContext.jsx"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <CatalogueCurrencyProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </CatalogueCurrencyProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
)
