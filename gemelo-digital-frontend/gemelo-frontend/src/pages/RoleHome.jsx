import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../utils/api";
import { injectStyles } from "../styles/global";

export default function RoleHome() {
  useEffect(() => { injectStyles(); }, []);

  const { authUser, logout, isInstructor, isStudent, isDualRole } = useAuth();
  const navigate = useNavigate();
  const firstName = (authUser?.user_name || "").split(" ")[0] || "Usuario";

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load all enrolled courses with roleName
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet("/brightspace/courses/enrolled?active_only=false&limit=200");
        if (alive) setCourses(Array.isArray(data?.items) ? data.items : []);
      } catch {
        // fallback: try my-course-offerings
        try {
          const data = await apiGet("/brightspace/my-course-offerings?active_only=false&limit=50");
          if (alive) setCourses((Array.isArray(data?.items) ? data.items : []).map(c => ({ ...c, roleName: "Instructor" })));
        } catch {}
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Classify courses by role
  const { instructorCourses, studentCourses } = useMemo(() => {
    const STUDENT_ROLES = ["estudiante ef", "student", "estudiante"];
    const inst = [];
    const stud = [];

    for (const c of courses) {
      const rn = String(c.roleName || "").toLowerCase().trim();
      if (STUDENT_ROLES.some(sr => rn.includes(sr))) {
        stud.push(c);
      } else if (rn) {
        inst.push(c);
      } else {
        // No role info — put in instructor (default)
        inst.push(c);
      }
    }

    // Sort: active first, then alphabetically
    const sorter = (a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
    };
    inst.sort(sorter);
    stud.sort(sorter);

    return { instructorCourses: inst, studentCourses: stud };
  }, [courses]);

  // Filter
  const filterCourses = useCallback((list) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      String(c.name || "").toLowerCase().includes(q) ||
      String(c.code || "").toLowerCase().includes(q) ||
      String(c.id || "").includes(q)
    );
  }, [search]);

  const filteredInst = filterCourses(instructorCourses);
  const filteredStud = filterCourses(studentCourses);

  const handleSelectCourse = (courseId, asRole) => {
    sessionStorage.setItem("gemelo_pending_org", String(courseId));
    // Navigate with full page load so the target page picks up the new orgUnitId
    const target = asRole === "student" ? "/portal" : "/dashboard";
    window.location.href = window.location.origin + target;
  };

  const CourseCard = ({ course, role }) => {
    const isActive = course.isActive !== false;
    return (
      <button
        onClick={() => handleSelectCourse(course.id, role)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)",
          background: "var(--bg)", cursor: "pointer", textAlign: "left",
          transition: "all 0.15s", fontFamily: "var(--font)", width: "100%",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = role === "student" ? "var(--ok)" : "var(--brand)"; e.currentTarget.style.background = role === "student" ? "var(--ok-bg)" : "var(--brand-light)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg)"; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>ID {course.id}{course.code ? ` · ${course.code}` : ""}</span>
            {!isActive && <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 6px", textTransform: "uppercase" }}>Inactivo</span>}
          </div>
        </div>
        <span style={{ color: role === "student" ? "var(--ok)" : "var(--brand)", fontSize: 16, flexShrink: 0 }}>→</span>
      </button>
    );
  };

  const SectionHeader = ({ icon, title, count, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{count} curso{count !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Top bar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 900 }}>CESA</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Gemelo Digital</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Selecciona tu vista</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
            {authUser?.user_name?.split(" ").slice(0, 2).join(" ")}
          </span>
          <button onClick={logout} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>Salir</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
        {/* Welcome */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Gemelo Digital</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
            Hola, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            {isDualRole
              ? "Tienes acceso como docente y como estudiante. Selecciona un curso para continuar."
              : isStudent
                ? "Selecciona un curso para ver tu información académica."
                : "Selecciona un curso para ver el tablero docente."
            }
          </p>
          {isDualRole && (
            <div style={{ display: "inline-flex", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: "var(--brand-light)", color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Docente</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: "var(--ok-bg)", color: "var(--ok)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Estudiante</span>
            </div>
          )}
        </div>

        {/* Search */}
        {!loading && courses.length > 0 && (
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Buscar por nombre, código o ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none" }}
              onFocus={e => e.target.style.borderColor = "var(--brand)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--muted)" }}>🔍</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
            <div style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--brand)", animation: "pulse 1.4s ease infinite", marginBottom: 12 }} />
            <div>Cargando tus cursos...</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* ── Cursos como Profesor ── */}
            {isInstructor && filteredInst.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 20px 16px", boxShadow: "var(--shadow)" }}>
                <SectionHeader icon="📊" title="Mis Cursos como Profesor" count={filteredInst.length} color="var(--brand)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {filteredInst.map(c => <CourseCard key={`inst-${c.id}`} course={c} role="instructor" />)}
                </div>
              </div>
            )}

            {/* ── Cursos como Estudiante ── */}
            {isStudent && filteredStud.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 20px 16px", boxShadow: "var(--shadow)" }}>
                <SectionHeader icon="🎓" title="Mis Cursos como Estudiante" count={filteredStud.length} color="var(--ok)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {filteredStud.map(c => <CourseCard key={`stud-${c.id}`} course={c} role="student" />)}
                </div>
              </div>
            )}

            {/* ── Solo estudiante sin doble rol ── */}
            {isStudent && !isInstructor && filteredStud.length === 0 && !search && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 16, background: "var(--card)" }}>
                <div style={{ fontSize: 36, opacity: 0.35, marginBottom: 8 }}>🎓</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Sin cursos encontrados</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Accede desde Brightspace usando el enlace de Gemelo Digital en tu curso.</div>
              </div>
            )}

            {/* ── No results for search ── */}
            {!loading && search && filteredInst.length === 0 && filteredStud.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>Sin resultados para "{search}"</div>
                <button onClick={() => setSearch("")} style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Limpiar búsqueda
                </button>
              </div>
            )}

            {/* Quick access buttons for single-role users who have courses */}
            {!isDualRole && !loading && courses.length > 0 && (
              <div style={{ textAlign: "center", paddingTop: 8 }}>
                <button
                  onClick={() => navigate(isStudent ? "/portal" : "/dashboard")}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}
                >
                  Ir al {isStudent ? "portal de estudiante" : "dashboard docente"} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0", fontSize: 11, color: "var(--muted)" }}>
          CESA · Gemelo Digital v2.0
        </div>
      </main>
    </div>
  );
}
