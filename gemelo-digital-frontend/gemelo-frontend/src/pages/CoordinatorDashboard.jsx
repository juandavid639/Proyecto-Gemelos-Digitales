import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../utils/api";
import { fmtPct, fmtGrade10FromPct, computeRiskFromPct } from "../utils/helpers";
import { COLORS, colorForPct } from "../utils/colors";
import { injectStyles } from "../styles/global";
import Breadcrumb from "../components/ui/Breadcrumb";

/**
 * CoordinatorDashboard: aggregated view of ALL courses for coordinators
 * or admins. Shows KPIs per course in a table with totals at the top.
 *
 * Accessible at /coordinator. Any user whose Brightspace role is
 * "Coordinador Administrativo" or "Super Administrator" gets access.
 */
export default function CoordinatorDashboard() {
  useEffect(() => { injectStyles(); }, []);
  const navigate = useNavigate();
  const { authUser, logout } = useAuth();

  const [courses, setCourses] = useState([]);
  const [courseMetrics, setCourseMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("atRiskPct"); // atRiskPct | avgPct | name
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Load courses the user has access to
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet("/brightspace/courses/enrolled?active_only=true&limit=200");
        if (!alive) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        const STUDENT_ROLES = ["estudiante ef", "student"];
        // Coordinators typically see all non-student courses
        const relevant = items.filter((c) => {
          const rn = String(c.roleName || "").toLowerCase();
          return !STUDENT_ROLES.some((sr) => rn.includes(sr));
        });
        setCourses(relevant);
      } catch {
        setCourses([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Fetch overview for each course (rate-limited parallelism: 5 at a time)
  useEffect(() => {
    if (courses.length === 0) return;
    let alive = true;
    (async () => {
      const results = {};
      const CONCURRENCY = 5;
      const queue = [...courses];
      async function worker() {
        while (queue.length > 0 && alive) {
          const c = queue.shift();
          if (!c) break;
          try {
            const ov = await apiGet(`/gemelo/course/${c.id}/overview`);
            if (!alive) return;
            const total = Number(ov?.studentsCount ?? 0);
            const atRiskCount = Number(ov?.studentsAtRisk?.length ?? 0);
            results[c.id] = {
              totalStudents: total,
              avgPct: ov?.courseGradebook?.avgCurrentPerformancePct ?? null,
              avgCoverage: ov?.courseGradebook?.avgCoveragePct ?? null,
              atRiskCount,
              atRiskPct: total > 0 ? (atRiskCount / total) * 100 : null,
            };
            // Incremental update so UI fills in
            if (alive) setCourseMetrics((prev) => ({ ...prev, [c.id]: results[c.id] }));
          } catch {
            results[c.id] = { error: true };
            if (alive) setCourseMetrics((prev) => ({ ...prev, [c.id]: results[c.id] }));
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    })();
    return () => { alive = false; };
  }, [courses]);

  // Derived: totals across all courses
  // totals respects the active filters (semester/category/search)
  const totals = useMemo(() => {
    // We use sortedCourses (already filtered) to aggregate
    // but sortedCourses is declared AFTER — defer computation to metrics only
    const metrics = Object.values(courseMetrics).filter((m) => !m.error);
    if (metrics.length === 0) {
      return { totalStudents: 0, atRiskCount: 0, avgGrade: null, avgCoverage: null, coursesLoaded: 0 };
    }
    const totalStudents = metrics.reduce((a, m) => a + (m.totalStudents || 0), 0);
    const atRiskCount = metrics.reduce((a, m) => a + (m.atRiskCount || 0), 0);
    const withAvg = metrics.filter((m) => m.avgPct != null);
    const avgGrade = withAvg.length > 0 ? (withAvg.reduce((a, m) => a + m.avgPct, 0) / withAvg.length) : null;
    const withCov = metrics.filter((m) => m.avgCoverage != null);
    const avgCoverage = withCov.length > 0 ? (withCov.reduce((a, m) => a + m.avgCoverage, 0) / withCov.length) : null;
    return { totalStudents, atRiskCount, avgGrade, avgCoverage, coursesLoaded: metrics.length };
  }, [courseMetrics]);

  // Helper: extract semester code (YYYYQQ) from course name/code.
  // Accepts formats like "202510", "202520", "202610", "202620".
  // Also supports loose matches like "2025-10", "2025.10", "2025 1".
  const extractSemester = (course) => {
    const hay = `${course?.name || ""} ${course?.code || ""}`;
    // Strict match: 6 consecutive digits starting with 20xx
    const strict = hay.match(/\b(20\d{2})(10|20|30)\b/);
    if (strict) return `${strict[1]}${strict[2]}`;
    // Loose: "2025-1", "2025.1", "2025 1" -> 202510
    const loose = hay.match(/\b(20\d{2})[\s\-._](\d)\b/);
    if (loose) {
      const q = loose[2];
      if (q === "1") return `${loose[1]}10`;
      if (q === "2") return `${loose[1]}20`;
      if (q === "3") return `${loose[1]}30`;
    }
    return null;
  };

  // Helper: extract "category" — the non-numeric prefix of the course name.
  // E.g. "202510 1ER PREGRADO INTELIGENCIA ARTIFICIAL" → "1ER PREGRADO"
  // E.g. "AULA PLAN DE DESARROLLO" → "AULA"
  // We take the first 2 significant words after any leading semester code.
  const extractCategory = (course) => {
    let name = String(course?.name || "").trim();
    // Remove leading semester code
    name = name.replace(/^20\d{2}(?:10|20|30)\s*[-·_]?\s*/i, "");
    // Take first 2-3 uppercase-ish words
    const words = name.split(/\s+/).filter(w => w.length > 0 && !/^\d+$/.test(w));
    if (words.length === 0) return "SIN CATEGORÍA";
    // Known category patterns — prefer these
    const upper = name.toUpperCase();
    if (/PREGRADO/.test(upper)) {
      const m = upper.match(/(\d+ER\s+PREGRADO|1ER\s+PREGRADO|PREGRADO)/);
      return m ? m[0].trim() : "PREGRADO";
    }
    if (/POSGRADO|MAESTR|DOCTORADO/.test(upper)) return "POSGRADO";
    if (/AULA/.test(upper)) return "AULA";
    if (/DESARROLLO/.test(upper)) return "DESARROLLO";
    if (/DIPLOMADO/.test(upper)) return "DIPLOMADO";
    if (/EDUCACI/.test(upper)) return "EDUCACIÓN CONTINUA";
    // Fallback: first word in caps
    return words[0].toUpperCase();
  };

  // Compute available semesters and categories (unique, sorted)
  const { availableSemesters, availableCategories } = useMemo(() => {
    const sems = new Set();
    const cats = new Set();
    for (const c of courses) {
      const s = extractSemester(c);
      if (s) sems.add(s);
      const cat = extractCategory(c);
      if (cat) cats.add(cat);
    }
    return {
      availableSemesters: Array.from(sems).sort().reverse(), // newest first
      availableCategories: Array.from(cats).sort(),
    };
  }, [courses]);

  // Label for semester code: "202510" → "2025-I", "202520" → "2025-II"
  const formatSemester = (code) => {
    if (!code || code.length !== 6) return code;
    const year = code.slice(0, 4);
    const q = code.slice(4, 6);
    const roman = q === "10" ? "I" : q === "20" ? "II" : q === "30" ? "III" : q;
    return `${year}-${roman}`;
  };

  const sortedCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courses.filter((c) => {
      // Search filter
      if (q && !(String(c.name || "").toLowerCase().includes(q) || String(c.code || "").toLowerCase().includes(q))) {
        return false;
      }
      // Semester filter
      if (semesterFilter !== "all") {
        const s = extractSemester(c);
        if (semesterFilter === "_none" && s != null) return false;
        if (semesterFilter !== "_none" && s !== semesterFilter) return false;
      }
      // Category filter
      if (categoryFilter !== "all") {
        const cat = extractCategory(c);
        if (cat !== categoryFilter) return false;
      }
      return true;
    });
    const withMetrics = list.map((c) => ({
      ...c,
      m: courseMetrics[c.id] || {},
      _semester: extractSemester(c),
      _category: extractCategory(c),
    }));
    withMetrics.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""), "es");
      if (sortBy === "avgPct") return (b.m.avgPct ?? -1) - (a.m.avgPct ?? -1);
      if (sortBy === "atRiskPct") return (b.m.atRiskPct ?? -1) - (a.m.atRiskPct ?? -1);
      if (sortBy === "semester") return String(b._semester || "").localeCompare(String(a._semester || ""));
      return 0;
    });
    return withMetrics;
  }, [courses, courseMetrics, search, sortBy, semesterFilter, categoryFilter]);

  // Totals for the currently-filtered view
  const filteredTotals = useMemo(() => {
    const metrics = sortedCourses.map((c) => c.m).filter((m) => m && !m.error);
    if (metrics.length === 0) {
      return { totalStudents: 0, atRiskCount: 0, avgGrade: null, avgCoverage: null };
    }
    const totalStudents = metrics.reduce((a, m) => a + (m.totalStudents || 0), 0);
    const atRiskCount = metrics.reduce((a, m) => a + (m.atRiskCount || 0), 0);
    const withAvg = metrics.filter((m) => m.avgPct != null);
    const avgGrade = withAvg.length > 0 ? (withAvg.reduce((a, m) => a + m.avgPct, 0) / withAvg.length) : null;
    const withCov = metrics.filter((m) => m.avgCoverage != null);
    const avgCoverage = withCov.length > 0 ? (withCov.reduce((a, m) => a + m.avgCoverage, 0) / withCov.length) : null;
    return { totalStudents, atRiskCount, avgGrade, avgCoverage };
  }, [sortedCourses]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Topbar */}
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
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Panel Coordinador
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn" onClick={() => navigate("/dashboard")} style={{ padding: "7px 12px", fontSize: 12 }}>
            📊 Vista docente
          </button>
          <button onClick={logout} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </header>

      <main style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <Breadcrumb items={[
          { label: "Inicio", icon: "🏠", onClick: () => navigate("/") },
          { label: "Panel Coordinador" },
        ]} />

        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
          Vista de coordinación
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", marginBottom: 4 }}>
          Panel Coordinador
        </h1>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, fontWeight: 500 }}>
          Vista agregada de {courses.length} curso{courses.length !== 1 ? "s" : ""} · {totals.coursesLoaded} cargado{totals.coursesLoaded !== 1 ? "s" : ""}
        </div>

        {/* KPI totals (reflects current filters) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div className="kpi-card">
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cursos</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{sortedCourses.length}</div>
            {sortedCourses.length !== courses.length && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                de {courses.length} totales
              </div>
            )}
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Estudiantes</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{filteredTotals.totalStudents}</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Nota promedio</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: colorForPct(filteredTotals.avgGrade, null), marginTop: 4 }}>
              {filteredTotals.avgGrade != null ? fmtGrade10FromPct(filteredTotals.avgGrade) : "—"}
              <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>/10</span>
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>En riesgo</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.critical, marginTop: 4 }}>
              {filteredTotals.atRiskCount}
              <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
                {filteredTotals.totalStudents > 0 && ` · ${((filteredTotals.atRiskCount / filteredTotals.totalStudents) * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Search + filters + sort */}
        <div className="kpi-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar curso..."
              aria-label="Buscar curso"
              style={{
                flex: 1, minWidth: 200, padding: "8px 12px",
                borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--text)",
                fontSize: 12, fontFamily: "var(--font)", outline: "none",
              }}
            />

            {/* Semester filter */}
            {availableSemesters.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                Semestre:
                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                  aria-label="Filtrar por semestre"
                  style={{
                    padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--card)", color: "var(--text)",
                    fontSize: 12, fontFamily: "var(--font)", outline: "none",
                    fontWeight: 700,
                  }}
                >
                  <option value="all">Todos</option>
                  {availableSemesters.map((s) => (
                    <option key={s} value={s}>{formatSemester(s)}</option>
                  ))}
                  <option value="_none">Sin semestre</option>
                </select>
              </label>
            )}

            {/* Category filter */}
            {availableCategories.length > 1 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                Categoría:
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtrar por categoría"
                  style={{
                    padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--card)", color: "var(--text)",
                    fontSize: 12, fontFamily: "var(--font)", outline: "none",
                    fontWeight: 700, maxWidth: 180,
                  }}
                >
                  <option value="all">Todas</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar por"
              style={{
                padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--card)", color: "var(--text)",
                fontSize: 12, fontFamily: "var(--font)", outline: "none",
              }}
            >
              <option value="atRiskPct">Mayor riesgo primero</option>
              <option value="avgPct">Mejor nota primero</option>
              <option value="semester">Semestre reciente primero</option>
              <option value="name">Nombre A-Z</option>
            </select>

            {(semesterFilter !== "all" || categoryFilter !== "all" || search) && (
              <button
                className="btn"
                onClick={() => { setSemesterFilter("all"); setCategoryFilter("all"); setSearch(""); }}
                style={{ fontSize: 11, padding: "6px 12px" }}
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {/* Active filter summary */}
          {(semesterFilter !== "all" || categoryFilter !== "all") && (
            <div style={{ padding: "8px 18px", background: "var(--brand-light)", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>
              Mostrando {sortedCourses.length} de {courses.length} cursos
              {semesterFilter !== "all" && <> · Semestre: <strong>{semesterFilter === "_none" ? "Sin semestre" : formatSemester(semesterFilter)}</strong></>}
              {categoryFilter !== "all" && <> · Categoría: <strong>{categoryFilter}</strong></>}
            </div>
          )}

          {/* Courses table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", textAlign: "left" }}>Curso</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", textAlign: "right" }}>Estudiantes</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", textAlign: "right" }}>Nota prom.</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", textAlign: "right" }}>Cobertura</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", textAlign: "right" }}>En riesgo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Cargando cursos...</td></tr>
                )}
                {!loading && sortedCourses.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Sin cursos encontrados.</td></tr>
                )}
                {sortedCourses.map(({ id, name, code, m, _semester, _category }) => {
                  const avgColor = m.avgPct != null ? colorForPct(m.avgPct, null) : "var(--muted)";
                  const riskColor = m.atRiskPct == null ? "var(--muted)"
                    : m.atRiskPct > 30 ? COLORS.critical
                    : m.atRiskPct > 15 ? COLORS.watch
                    : COLORS.ok;
                  return (
                    <tr
                      key={id}
                      onClick={() => {
                        sessionStorage.setItem("gemelo_pending_org", String(id));
                        window.location.href = window.location.origin + "/dashboard";
                      }}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      className="tr-hover"
                    >
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        <div>{name}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                          {code && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{code}</span>}
                          {_semester && <span className="tag" style={{ fontSize: 9, padding: "1px 6px" }}>{formatSemester(_semester)}</span>}
                          {_category && _category !== "SIN CATEGORÍA" && (
                            <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {_category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 700 }}>
                        {m.totalStudents != null ? m.totalStudents : "..."}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 16, fontWeight: 900, fontFamily: "var(--font-mono)", color: avgColor }}>
                        {m.avgPct != null ? (m.avgPct / 10).toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                        {m.avgCoverage != null ? `${m.avgCoverage.toFixed(0)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 800, color: riskColor }}>
                        {m.atRiskCount != null ? `${m.atRiskCount} (${m.atRiskPct?.toFixed(0)}%)` : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <span style={{ color: "var(--brand)", fontSize: 16 }}>→</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "24px 0", fontSize: 11, color: "var(--muted)" }}>
          CESA · Gemelo Digital v2.0 · Panel Coordinador
        </div>
      </main>
    </div>
  );
}
