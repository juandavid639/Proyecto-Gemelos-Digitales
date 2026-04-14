import React, { useState } from "react";

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_GEMELO_BASE_URL ||
  ""
).replace(/\/$/, "");

/**
 * Avatar component that attempts to load the user's profile image from
 * Brightspace. Falls back to an initial-based circle if the image fails.
 *
 * Usage:
 *   <StudentAvatar userId={123} name="Juan Perez" size={40} />
 */
export default function StudentAvatar({ userId, name, size = 40, style = {} }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const sid = typeof localStorage !== "undefined" ? localStorage.getItem("gemelo_sid") : null;

  // Build URL with sid as query param so <img> can load with auth
  // (img tags can't set Authorization headers directly)
  const imageUrl = userId && sid && !failed
    ? `${API_BASE_URL}/brightspace/user/${userId}/image?sid=${encodeURIComponent(sid)}`
    : null;

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: "var(--brand-light)",
    border: "2px solid var(--brand-light2, #D6E4FF)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    ...style,
  };

  if (!imageUrl || failed) {
    return (
      <div style={baseStyle} aria-label={`Avatar de ${name || "estudiante"}`}>
        <span style={{
          fontSize: Math.round(size * 0.4),
          fontWeight: 900,
          color: "var(--brand)",
        }}>{initial}</span>
      </div>
    );
  }

  return (
    <div style={baseStyle}>
      <img
        src={imageUrl}
        alt={name || "Estudiante"}
        onError={() => setFailed(true)}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
