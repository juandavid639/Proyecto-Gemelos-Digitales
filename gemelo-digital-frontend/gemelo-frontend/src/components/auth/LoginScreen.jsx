import React from "react";
import { injectStyles } from "../../styles/global";

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_GEMELO_BASE_URL ||
  ""
).replace(/\/$/, "");

function apiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export default function LoginScreen({ orgUnitId }) {
  React.useEffect(() => { injectStyles(); }, []);

  const loginUrl = apiUrl(
    orgUnitId && orgUnitId > 0
      ? `/auth/brightspace/login?org_unit_id=${orgUnitId}`
      : "/auth/brightspace/login"
  );

  return (
    <main
      role="main"
      aria-label="Inicio de sesión - Gemelo Digital CESA"
      style={{
        minHeight: "100vh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Manrope', system-ui, sans-serif", padding: 20,
      }}
    >
      <div
        role="region"
        aria-label="Formulario de autenticación"
        style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 24, padding: "40px 48px",
          textAlign: "center", maxWidth: 440, width: "100%",
          boxShadow: "0 8px 32px rgba(15,24,39,0.12), 0 16px 48px rgba(15,24,39,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: "var(--brand)", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em",
          }}>CESA</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Gemelo Digital
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              v2.0
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)", margin: "0 0 28px" }} />

        <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Bienvenido
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 28px" }}>
          Para acceder a tu tablero, inicia sesión con tu cuenta CESA de Brightspace.
          Serás redirigido a Microsoft para autenticarte.
        </p>

        <a
          href={loginUrl}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "13px 20px",
            background: "var(--brand)", color: "#fff",
            borderRadius: 12, textDecoration: "none",
            fontSize: 14, fontWeight: 800,
            boxShadow: "0 4px 16px rgba(11,95,255,0.3)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="0"  y="0"  width="10" height="10" fill="#F25022"/>
            <rect x="11" y="0"  width="10" height="10" fill="#7FBA00"/>
            <rect x="0"  y="11" width="10" height="10" fill="#00A4EF"/>
            <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
          </svg>
          Iniciar sesión con Microsoft
        </a>

        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 18, lineHeight: 1.5 }}>
          Docentes y estudiantes con cursos activos en Brightspace pueden acceder.
          Si tienes problemas, contacta a soporte CESA.
        </p>

        <div style={{
          marginTop: 20, padding: "10px 14px", borderRadius: 10,
          background: "var(--brand-light)", border: "1px solid var(--brand-light2, #D6E4FF)",
        }}>
          <p style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700, margin: 0 }}>
            También puedes acceder directamente desde tu curso en Brightspace
            usando el enlace de la herramienta Gemelo Digital.
          </p>
        </div>
      </div>
    </main>
  );
}
