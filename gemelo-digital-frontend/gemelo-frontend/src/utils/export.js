/**
 * Export utilities — generate CSV and printable HTML reports from
 * course / student data. No external libraries required.
 */

/**
 * Escape a CSV field (wrap in quotes if contains comma/quote/newline).
 */
function escCsv(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Trigger a browser download of a blob with a given filename.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Export the full students roster of a course to CSV.
 */
export function exportStudentsCsv(studentRows, courseInfo) {
  const rows = Array.isArray(studentRows) ? studentRows : [];
  const headers = [
    "ID", "Nombre", "Email", "Nota (0-10)", "Cobertura %",
    "Riesgo", "Ruta", "RA crítico", "Pendientes %", "Vencidos %",
  ];
  const lines = [headers.map(escCsv).join(",")];
  for (const s of rows) {
    lines.push([
      s.userId,
      s.displayName,
      s.email || "",
      s.currentPerformancePct != null ? (s.currentPerformancePct / 10).toFixed(1) : "",
      s.coveragePct != null ? s.coveragePct.toFixed(1) : "",
      s.risk || "",
      s.route?.title || "",
      s.mostCriticalMacro?.code || "",
      s.pendingSubmittedWeightPct != null ? s.pendingSubmittedWeightPct.toFixed(1) : "",
      s.notSubmittedWeightPct != null ? s.notSubmittedWeightPct.toFixed(1) : (s.overdueWeightPct != null ? s.overdueWeightPct.toFixed(1) : ""),
    ].map(escCsv).join(","));
  }
  const content = "\uFEFF" + lines.join("\r\n"); // BOM for Excel UTF-8
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const ts = new Date().toISOString().slice(0, 10);
  const courseSafe = String(courseInfo?.Name || "curso").replace(/[^\w]+/g, "_").slice(0, 40);
  downloadBlob(blob, `gemelo_${courseSafe}_${ts}.csv`);
}

/**
 * Open a new window with a printable HTML report of the full course
 * (header + stats + students table). User can use browser print dialog.
 */
export function exportCourseReport(studentRows, courseInfo, overview) {
  const rows = Array.isArray(studentRows) ? studentRows : [];
  const today = new Date().toLocaleString("es-CO");
  const courseName = courseInfo?.Name || "Curso";
  const totalStudents = rows.length;
  const avgPct = overview?.courseGradebook?.avgCurrentPerformancePct;
  const avgCov = overview?.courseGradebook?.avgCoveragePct;

  const riskCounts = { alto: 0, medio: 0, bajo: 0, pending: 0 };
  for (const s of rows) {
    const p = s.currentPerformancePct;
    if (p == null) riskCounts.pending++;
    else if (p < 50) riskCounts.alto++;
    else if (p < 70) riskCounts.medio++;
    else riskCounts.bajo++;
  }

  const rowsHtml = rows.map((s) => {
    const grade = s.currentPerformancePct != null ? (s.currentPerformancePct / 10).toFixed(1) : "—";
    const cov = s.coveragePct != null ? s.coveragePct.toFixed(1) + "%" : "—";
    const risk = s.risk || "—";
    const color = s.currentPerformancePct != null && s.currentPerformancePct < 50 ? "#D92D20"
                : s.currentPerformancePct != null && s.currentPerformancePct < 70 ? "#E8900A"
                : s.currentPerformancePct != null ? "#12B76A" : "#8B96A8";
    return `<tr>
      <td style="font-family:monospace;color:#5A6580">${s.userId}</td>
      <td>${escapeHtml(s.displayName || "")}</td>
      <td style="text-align:right;font-weight:900;color:${color}">${grade}</td>
      <td style="text-align:right">${cov}</td>
      <td style="text-align:center;text-transform:uppercase;font-size:10px;font-weight:800">${risk}</td>
      <td style="font-size:11px;color:#5A6580">${escapeHtml(s.route?.title || "")}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte ${escapeHtml(courseName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Manrope, sans-serif; padding: 30px 40px; color: #0F1827; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { font-size: 12px; color: #5A6580; margin-bottom: 24px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { flex: 1; min-width: 140px; padding: 14px; border: 1px solid #E4E8EF; border-radius: 10px; }
  .stat-label { font-size: 10px; color: #5A6580; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .stat-value { font-size: 28px; font-weight: 900; margin-top: 4px; letter-spacing: -0.02em; }
  .risk-grid { display: flex; gap: 8px; margin-bottom: 24px; }
  .risk-item { flex: 1; padding: 10px; border-radius: 8px; text-align: center; }
  .risk-alto { background: #FEF3F2; color: #B42318; }
  .risk-medio { background: #FFF8ED; color: #9A3412; }
  .risk-bajo { background: #ECFDF3; color: #1B5E20; }
  .risk-pending { background: #F1F3F7; color: #5A6580; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #F2F4F8; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #5A6580; border-bottom: 2px solid #E4E8EF; }
  td { padding: 6px 10px; border-bottom: 1px solid #E4E8EF; }
  tr:nth-child(even) { background: #FAFBFD; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E4E8EF; font-size: 10px; color: #5A6580; text-align: center; }
  @media print {
    body { padding: 20px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Gemelo Digital · Reporte de Curso</h1>
  <div class="sub">${escapeHtml(courseName)} · Generado ${escapeHtml(today)}</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Estudiantes</div>
      <div class="stat-value">${totalStudents}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Nota promedio</div>
      <div class="stat-value">${avgPct != null ? (avgPct / 10).toFixed(1) : "—"}<span style="font-size:14px;color:#5A6580">/10</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">Cobertura</div>
      <div class="stat-value">${avgCov != null ? avgCov.toFixed(1) + "%" : "—"}</div>
    </div>
  </div>

  <div class="risk-grid">
    <div class="risk-item risk-alto">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase">Alto</div>
      <div style="font-size:22px;font-weight:900">${riskCounts.alto}</div>
    </div>
    <div class="risk-item risk-medio">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase">Medio</div>
      <div style="font-size:22px;font-weight:900">${riskCounts.medio}</div>
    </div>
    <div class="risk-item risk-bajo">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase">Bajo</div>
      <div style="font-size:22px;font-weight:900">${riskCounts.bajo}</div>
    </div>
    <div class="risk-item risk-pending">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase">Sin datos</div>
      <div style="font-size:22px;font-weight:900">${riskCounts.pending}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th><th>Nombre</th><th style="text-align:right">Nota</th><th style="text-align:right">Cobertura</th><th style="text-align:center">Riesgo</th><th>Ruta</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="footer">
    CESA · Gemelo Digital v2.0 · Reporte generado automáticamente
  </div>

  <script>
    // Auto-open print dialog after load (user can cancel)
    setTimeout(() => { window.print(); }, 400);
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("No se pudo abrir la ventana de reporte. Revisa tu bloqueador de pop-ups.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
