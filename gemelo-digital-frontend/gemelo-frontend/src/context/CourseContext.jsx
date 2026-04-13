import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { apiGet } from "../utils/api";
import { computeRiskFromPct, suggestRouteForStudent, flattenOutcomeDescriptions } from "../utils/helpers";

const CourseContext = createContext(null);

export function CourseProvider({ children, orgUnitId: externalOrgUnitId }) {
  // orgUnitId can be controlled externally or internally
  const [orgUnitId, setOrgUnitId] = useState(externalOrgUnitId || 0);
  const [orgUnitInput, setOrgUnitInput] = useState(String(externalOrgUnitId || ""));

  // Sync with external prop
  useEffect(() => {
    if (externalOrgUnitId && externalOrgUnitId !== orgUnitId) {
      setOrgUnitId(externalOrgUnitId);
      setOrgUnitInput(String(externalOrgUnitId));
    }
  }, [externalOrgUnitId]);

  // Course data state
  const [overview, setOverview] = useState(null);
  const [studentsList, setStudentsList] = useState(null);
  const [studentRows, setStudentRows] = useState([]);
  const [raDashboard, setRaDashboard] = useState(null);
  const [learningOutcomesPayload, setLearningOutcomesPayload] = useState(null);
  const [outcomesMap, setOutcomesMap] = useState({});
  const [contentRoot, setContentRoot] = useState([]);
  const [courseInfo, setCourseInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Course list state
  const [courseList, setCourseList] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseListLoaded, setCourseListLoaded] = useState(false);

  const thresholds = overview?.thresholds || { critical: 50, watch: 70 };

  // Search courses
  const searchCourses = useCallback(async (term) => {
    setLoadingCourses(true);
    try {
      const q = term && term.trim().length > 0 ? term.trim() : "";
      const qs = q ? `?active_only=false&limit=50&search=${encodeURIComponent(q)}` : `?active_only=false&limit=50`;

      const [myData, allData] = await Promise.allSettled([
        apiGet(`/brightspace/my-course-offerings${qs}`),
        apiGet(`/brightspace/all-courses${qs}`),
      ]);

      const myItems  = myData.status  === "fulfilled" ? (Array.isArray(myData.value?.items)  ? myData.value.items  : []) : [];
      const allItems = allData.status === "fulfilled" ? (Array.isArray(allData.value?.items) ? allData.value.items : []) : [];

      const idSet = new Set(myItems.map(c => String(c.id)));
      const final = allItems.length > 0
        ? allItems.map(c => ({ ...c, enrolled: idSet.has(String(c.id)) }))
        : myItems;

      final.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
      });

      setCourseList(final.length > 0 ? final : myItems);
      setCourseListLoaded(true);
    } catch {
      // no bloquear
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadCourseList = useCallback(async () => {
    if (courseListLoaded || loadingCourses) return;
    await searchCourses("");
  }, [courseListLoaded, loadingCourses, searchCourses]);

  const selectCourse = useCallback((id) => {
    const v = Number(id);
    if (v > 0) {
      setOrgUnitId(v);
      setOrgUnitInput(String(v));
    }
  }, []);

  const clearCourse = useCallback(() => {
    setOrgUnitId(0);
    setOrgUnitInput("");
    setError("");
    setOverview(null);
  }, []);

  return (
    <CourseContext.Provider value={{
      orgUnitId,
      orgUnitInput,
      setOrgUnitId: selectCourse,
      setOrgUnitInput,
      clearCourse,

      overview,
      setOverview,
      studentsList,
      setStudentsList,
      studentRows,
      setStudentRows,
      raDashboard,
      setRaDashboard,
      learningOutcomesPayload,
      setLearningOutcomesPayload,
      outcomesMap,
      setOutcomesMap,
      contentRoot,
      setContentRoot,
      courseInfo,
      setCourseInfo,

      loading,
      setLoading,
      error,
      setError,

      thresholds,

      courseList,
      loadingCourses,
      courseListLoaded,
      setCourseListLoaded,
      searchCourses,
      loadCourseList,
    }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourse must be used within CourseProvider");
  return ctx;
}
