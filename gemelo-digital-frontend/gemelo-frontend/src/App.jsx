import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginScreen from "./components/auth/LoginScreen";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentPortal from "./pages/StudentPortal";
import { injectStyles } from "./styles/global";

function AppRoutes() {
  const { authUser, authChecked, role } = useAuth();

  // Not checked yet — AuthProvider handles the loading state
  if (!authChecked) return null;

  // Not authenticated — show login
  if (!authUser) return <LoginScreen />;

  return (
    <Routes>
      {/* Teacher/Admin dashboard */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute allowedRoles={["instructor", "admin"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      {/* Student portal */}
      <Route
        path="/portal/*"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentPortal />
          </ProtectedRoute>
        }
      />

      {/* Login page (accessible to all) */}
      <Route path="/login" element={<LoginScreen />} />

      {/* Default redirect based on role */}
      <Route
        path="*"
        element={
          <Navigate
            to={role === "student" ? "/portal" : "/dashboard"}
            replace
          />
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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
