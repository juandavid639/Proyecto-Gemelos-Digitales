import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { authUser, authChecked, role } = useAuth();

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "40px 48px", textAlign: "center", boxShadow: "0 8px 32px rgba(15,24,39,0.12)", minWidth: 320, maxWidth: 480 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>CESA · Gemelo Digital v2.0</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Verificando sesión...</div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={role === "student" ? "/portal" : "/dashboard"} replace />;
  }

  return children;
}
