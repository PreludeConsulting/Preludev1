import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App.jsx";
import DashboardRouter from "./dashboard/DashboardRouter.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage
} from "./components/AuthPages.jsx";
import { ROUTER_BASENAME } from "./lib/appPaths.js";
import "./index.css";
import "./dashboard/dashboard.css";
import "./dashboard/dashboard-premium.css";
import "./dashboard/dashboard-product.css";
import "./landing-ui.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={ROUTER_BASENAME || undefined}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/dashboard/*" element={<DashboardRouter />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
