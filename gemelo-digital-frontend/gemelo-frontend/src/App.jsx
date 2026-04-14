import React, { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { I18nProvider } from "./context/I18nContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginScreen from "./components/auth/LoginScreen";
import { injectStyles } from "./styles/global";

// Lazy-loaded pages for code splitting
const RoleHome = lazy(() => import("./pages/RoleHome"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const StudentPortal = lazy(() => import("./pages/StudentPortal"));
const CoordinatorDashboard = lazy(() => import("./pages/CoordinatorDashboard"));

// Suspense fallback — lightweight loader
function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Cargando página"
      style={{
        minHeight: "100vh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 24, padding: "40px 48px", textAlign: "center",
        boxShadow: "0 8px 32px rgba(15,24,39,0.12)",
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>CESA · Gemelo Digital</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Cargando...</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { authUser, authChecked, isDualRole, isStudent } = useAuth();

  if (!authChecked) return <PageLoader />;
  if (!authUser) return <LoginScreen />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Teacher/Admin dashboard */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute allowedRoles={["instructor", "admin"]}>
              <ErrorBoundary sectionName="Dashboard Docente">
                <TeacherDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Coordinator dashboard (any non-student can access) */}
        <Route
          path="/coordinator"
          element={
            <ProtectedRoute allowedRoles={["instructor", "admin"]}>
              <ErrorBoundary sectionName="Panel Coordinador">
                <CoordinatorDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Student portal */}
        <Route
          path="/portal/*"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <ErrorBoundary sectionName="Portal Estudiante">
                <StudentPortal />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Login page */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Home — role selector for dual-role, auto-redirect for single-role */}
        <Route
          path="/"
          element={
            isDualRole
              ? <RoleHome />
              : <Navigate to={isStudent ? "/portal" : "/dashboard"} replace />
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={
            isDualRole
              ? <Navigate to="/" replace />
              : <Navigate to={isStudent ? "/portal" : "/dashboard"} replace />
          }
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ErrorBoundary sectionName="Gemelo Digital">
                <AppRoutes />
              </ErrorBoundary>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
