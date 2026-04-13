import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginScreen from "./components/auth/LoginScreen";
import RoleHome from "./pages/RoleHome";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentPortal from "./pages/StudentPortal";
import { injectStyles } from "./styles/global";

function AppRoutes() {
  const { authUser, authChecked, isDualRole, isInstructor, isStudent } = useAuth();

  if (!authChecked) return null;
  if (!authUser) return <LoginScreen />;

  return (
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
  );
}

export default function App() {
  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary sectionName="Gemelo Digital">
              <AppRoutes />
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
