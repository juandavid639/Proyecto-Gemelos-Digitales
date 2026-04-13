import React, { createContext, useContext, useState, useEffect } from "react";

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_GEMELO_BASE_URL ||
  ""
).replace(/\/$/, "");

function apiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

const AuthContext = createContext(null);

// Map Brightspace roles to app roles
function mapRole(backendRole) {
  if (!backendRole) return "instructor"; // default
  const r = String(backendRole).toLowerCase();
  if (r.includes("estudiante")) return "student";
  if (r.includes("student")) return "student";
  // Everything else: instructor, admin, coordinator
  return "instructor";
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [initialOrgUnitId, setInitialOrgUnitId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Read hash fragment from OAuth callback
        // Format: #gemelo:SESSION_ID:orgUnitId:first_login
        let _sid = null;
        let _hashOu = null;
        const _hash = window.location.hash;
        if (_hash.startsWith("#gemelo:")) {
          const parts = _hash.slice(1).split(":");
          if (parts.length >= 2) {
            _sid    = parts[1] || null;
            _hashOu = parts[2] && Number(parts[2]) > 0 ? Number(parts[2]) : null;
            const _fl = parts[3];
            if (_fl === "1") sessionStorage.setItem("gemelo_first_login", "1");
          }
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }

        // Fallback: read from localStorage
        if (!_sid) _sid = localStorage.getItem("gemelo_sid");

        // Save session_id
        if (_sid) localStorage.setItem("gemelo_sid", _sid);

        // Apply orgUnitId from hash
        if (_hashOu) {
          setInitialOrgUnitId(_hashOu);
        }

        // Call /auth/me
        const _meUrl = _sid
          ? apiUrl(`/auth/me?sid=${encodeURIComponent(_sid)}`)
          : apiUrl("/auth/me");
        const res = await fetch(_meUrl, {
          credentials: "include",
          headers: _sid ? { "Authorization": `Bearer ${_sid}` } : {},
        });
        const data = await res.json();
        if (data.authenticated) {
          // Add mapped role to user object
          const user = {
            ...data,
            appRole: mapRole(data.role),
          };
          setAuthUser(user);

          // Check for saved orgUnit from LTI
          const savedOu = sessionStorage.getItem("gemelo_pending_org");
          if (savedOu && Number(savedOu) > 0) {
            sessionStorage.removeItem("gemelo_pending_org");
            setInitialOrgUnitId(Number(savedOu));
          }

          // First-time tutorial detection
          const isFirstLogin = sessionStorage.getItem("gemelo_first_login") === "1";
          const alreadyOnboarded = localStorage.getItem("gemelo_onboarded") === "1";
          if (isFirstLogin || !alreadyOnboarded) {
            sessionStorage.removeItem("gemelo_first_login");
            setShowTutorial(true);
          }
        } else if (data.lti_detected) {
          const ou = data.org_unit_id || "";
          if (ou) sessionStorage.setItem("gemelo_pending_org", ou);
          const loginPath = ou
            ? apiUrl(`/auth/brightspace/login?org_unit_id=${ou}`)
            : apiUrl("/auth/brightspace/login");
          window.location.href = loginPath;
          return;
        }
      } catch {
        // offline / error -> show login
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const logout = async () => {
    try {
      const sid = localStorage.getItem("gemelo_sid");
      const hdrs = sid ? { Authorization: `Bearer ${sid}` } : {};
      await fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include", headers: hdrs });
    } catch {}
    localStorage.removeItem("gemelo_sid");
    sessionStorage.clear();
    window.location.reload();
  };

  const role = authUser?.appRole || "instructor";

  return (
    <AuthContext.Provider value={{
      authUser,
      authChecked,
      role,
      logout,
      showTutorial,
      setShowTutorial,
      initialOrgUnitId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
