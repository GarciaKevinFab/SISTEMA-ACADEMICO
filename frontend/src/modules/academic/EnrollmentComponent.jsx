// src/modules/academic/EnrollmentComponent.jsx
// ═══════════════════════════════════════════════════════════
// FEATURES:
//   ✅ DUAL MODE: Padrón de alumnos (admin) + Matrícula individual
//   ✅ Padrón: tabla con estado matriculado/pendiente, búsqueda, filtro carrera
//   ✅ Botón "Matricular" en padrón → carga alumno en vista individual
//   ✅ Stats: total / matriculados / pendientes (desde servidor, no de la página)
//   ✅ Maneja 4 estados de ventana: OPEN / EXTEMPORARY / CLOSED / FREE
//   ✅ EXTEMPORARY → aviso ámbar con monto de recargo
//   ✅ CLOSED       → bloquea validar/confirmar con mensaje rojo
//   ✅ Selector de período dinámico
//   ✅ Modo admin por DNI
//   ✅ Cursos bloqueados no seleccionables
//   ✅ Selector de sección por curso
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle, Trash2, BookOpen, Check, Library, AlertTriangle,
  Clock, Plus, Search as SearchIcon, FileText, Hash, User, Shield,
  ChevronDown, Lock, Unlock, AlertCircle, DollarSign, Calendar,
  Users, UserCheck, UserX, RefreshCw, ChevronLeft, ChevronRight,
  BookOpenCheck, Download,
} from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import EnrollmentPaymentGate from "./EnrollmentPaymentGate";

/* ─── helpers ─── */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.join(" | ");
  }
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

const pick = (obj, keys, fallback) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
};

const isAdminish = (user) => {
  const roles = user?.roles || user?.user_roles || user?.role_names || [];
  const names = Array.isArray(roles)
    ? roles.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
    : [];
  const allowed = new Set(["ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "ADMIN_SYSTEM", "REGISTRAR"]);
  if (user?.is_staff || user?.is_superuser) return true;
  return names.some((r) => allowed.has(String(r).toUpperCase()));
};

const normalizeSchedule = (course) => {
  if (typeof course?.schedule === "string") return course.schedule;
  const slots = Array.isArray(course?.slots)
    ? course.slots
    : Array.isArray(course?.schedule_slots)
      ? course.schedule_slots
      : [];
  if (!slots.length) return "";
  return slots.map((s) => `${s?.day ?? s?.weekday} ${s?.start}-${s?.end}`.trim()).join(", ");
};

const BLOCKED_LABELS = {
  YA_MATRICULADO_EN_PERIODO: "Ya matriculado",
  YA_APROBADO: "Ya aprobado",
  FALTA_PRERREQUISITOS: "Sin prerrequisitos",
};

const WINDOW_STATUS_CONFIG = {
  FREE: {
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    label: "Matrícula habilitada",
    Icon: Unlock,
    blocked: false,
  },
  OPEN: {
    badgeClass: "bg-green-100 text-green-700 border border-green-200",
    label: "Matrícula ABIERTA",
    Icon: CheckCircle,
    blocked: false,
  },
  EXTEMPORARY: {
    badgeClass: "bg-amber-100 text-amber-700 border border-amber-200",
    label: "Matrícula EXTEMPORÁNEA",
    Icon: AlertTriangle,
    blocked: false,
  },
  CLOSED: {
    badgeClass: "bg-red-100 text-red-700 border border-red-200",
    label: "Matrícula CERRADA",
    Icon: Lock,
    blocked: true,
  },
};

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toLocaleString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return isoStr; }
}

function generatePeriodOptions() {
  const now = new Date();
  const year = now.getFullYear();
  const opts = [];
  for (let y = year + 1; y >= year - 3; y--) {
    opts.push(`${y}-II`);
    opts.push(`${y}-I`);
  }
  return opts;
}

function guessPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() < 6 ? `${y}-I` : `${y}-II`;
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENT: Admin Student Roster
   ════════════════════════════════════════════════════════════ */
const StudentsRoster = ({ academicPeriod, api, onEnrollStudent }) => {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  // ── Totales globales desde el servidor (no de la página actual) ──
  const [enrolledCount, setEnrolledCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [careerFilter, setCareerFilter] = useState("");
  const [careers, setCareers] = useState([]);
  const [tab, setTab] = useState("all"); // all | enrolled | pending
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  /* ── Careers para el filtro ── */
  useEffect(() => {
    api.get("/academic/careers")
      .then((r) => {
        const list = r.data?.careers || r.data?.items || r.data || [];
        setCareers(Array.isArray(list) ? list : []);
      })
      .catch(() => { });
  }, [api]);

  /* ── Fetch students ── */
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        academic_period: academicPeriod,
        page,
        page_size: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (careerFilter) params.career_id = careerFilter;
      // Filtro de tab → backend para que la paginación funcione correctamente
      if (tab === "enrolled") params.enrolled = "true";
      if (tab === "pending") params.enrolled = "false";

      const { data } = await api.get("/academic/enrollments/students-overview", { params });

      setStudents(Array.isArray(data.students) ? data.students : []);
      setTotal(data.total ?? 0);

      // ── Leer totales del servidor (aplica a toda la BD con los filtros activos) ──
      // Backend retorna enrolled_count y pending_count tras el fix en StudentsOverviewView.
      // Fallback a null para que el display use el conteo de la página si no hay datos.
      const srvEnrolled = data.enrolled_count ?? data.matriculados ?? data.total_enrolled ?? null;
      const srvPending = data.pending_count ?? data.sin_matricular ?? data.total_pending ?? null;
      setEnrolledCount(srvEnrolled);
      setPendingCount(srvPending);

    } catch (e) {
      toast.error(formatApiError(e, "No se pudo cargar el padrón"));
    } finally {
      setLoading(false);
    }
  }, [api, academicPeriod, search, careerFilter, page, tab]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [search, careerFilter, academicPeriod, tab]);

  /* ── Filtered by tab (con filtro backend, visible = todos los de la página) ── */
  const visible = useMemo(() => {
    // Con filtro backend ya no filtramos localmente, pero por seguridad:
    if (tab === "enrolled") return students.filter((s) => s.is_enrolled);
    if (tab === "pending") return students.filter((s) => !s.is_enrolled);
    return students;
  }, [students, tab]);

  // Usar totales del servidor si están disponibles;
  // si no (backend viejo), contar en la página actual como fallback.
  const displayEnrolled = enrolledCount !== null
    ? enrolledCount
    : students.filter((s) => s.is_enrolled).length;
  const displayPending = pendingCount !== null
    ? pendingCount
    : students.filter((s) => !s.is_enrolled).length;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ── Generar fichas de matrícula en lote ── */
  const [generatingFichas, setGeneratingFichas] = useState(false);
  const handleGenerateFichas = async () => {
    setGeneratingFichas(true);
    try {
      const res = await api.post(
        "/academic/enrollments/generate-fichas",
        { academic_period: academicPeriod },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fichas-matricula-${academicPeriod}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Fichas de matrícula descargadas");
    } catch (e) {
      // Si el blob es JSON con error, intentar leerlo
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          toast.error(json.detail || "Error generando fichas");
        } catch {
          toast.error("Error generando fichas de matrícula");
        }
      } else {
        toast.error(formatApiError(e, "Error generando fichas de matrícula"));
      }
    } finally {
      setGeneratingFichas(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Stats cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{total}</div>
              <div className="text-xs text-slate-500">Total alumnos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{displayEnrolled}</div>
              <div className="text-xs text-green-600">Matriculados</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <UserX className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{displayPending}</div>
              <div className="text-xs text-amber-600">Sin matricular</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Botón Generar Fichas ── */}
      {displayEnrolled > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={generatingFichas}
            onClick={handleGenerateFichas}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {generatingFichas ? "Generando fichas…" : "Generar Fichas de Matrícula"}
          </Button>
        </div>
      )}

      {/* ── Filters ── */}
      <Card className="border-slate-200">
        <CardContent className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative sm:w-52">
            <select
              value={careerFilter}
              onChange={(e) => setCareerFilter(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-slate-200 bg-white px-3 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las carreras</option>
              {careers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          <Button variant="outline" size="sm" onClick={fetchStudents} disabled={loading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "all", label: `Todos (${total})` },
          { key: "enrolled", label: `Matriculados (${displayEnrolled})` },
          { key: "pending", label: `Sin matricular (${displayPending})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Alumno</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3 hidden md:table-cell">DNI</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3 hidden lg:table-cell">Carrera</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3 hidden sm:table-cell">Ciclo</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3">Estado</th>
                <th className="text-center font-medium text-slate-600 px-4 py-3 hidden md:table-cell">Cursos / Créditos</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <Clock className="h-5 w-5 animate-spin inline mr-2" />
                    Cargando padrón...
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No se encontraron alumnos
                  </td>
                </tr>
              ) : (
                visible.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 truncate max-w-[180px]">
                        {st.full_name || "—"}
                      </div>
                      <div className="text-xs text-slate-400 md:hidden">
                        {st.dni || st.num_documento}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-slate-600 text-xs">
                      {st.dni || st.num_documento || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 max-w-[160px] truncate text-xs">
                      {st.career_name || "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-center text-slate-600">
                      {st.semester ? `${st.semester}°` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.is_enrolled ? (
                        <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />Matriculado
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">
                          <UserX className="h-3 w-3 mr-1" />Pendiente
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-center text-slate-500 text-xs">
                      {st.is_enrolled
                        ? `${st.enrolled_courses_count} cur. / ${st.enrolled_credits} cr.`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={st.is_enrolled ? "outline" : "default"}
                        className={`text-xs ${st.is_enrolled
                            ? "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                            : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        onClick={() => onEnrollStudent(st.dni || st.num_documento, st)}
                      >
                        <BookOpenCheck className="h-3.5 w-3.5 mr-1" />
                        {st.is_enrolled ? "Ver / editar" : "Matricular"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Página {page} de {totalPages} · {total} alumnos
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};


/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
const EnrollmentComponent = () => {
  const { user, api } = useAuth();
  const adminMode = useMemo(() => isAdminish(user), [user]);

  const [adminView, setAdminView] = useState("roster"); // "roster" | "individual"
  const [rosterKey, setRosterKey] = useState(0);

  const [academicPeriod, setAcademicPeriod] = useState(guessPeriod);
  const [dni, setDni] = useState("");
  const [resolvedStudent, setResolvedStudent] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedSections, setSelectedSections] = useState({});
  const [validation, setValidation] = useState({ status: null, errors: [], warnings: [], suggestions: [] });
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const windowStatus = useMemo(() => {
    if (!windowInfo) return "FREE";
    return windowInfo.status || (windowInfo.is_open ? "OPEN" : "CLOSED");
  }, [windowInfo]);
  const windowBlocked = useMemo(() => WINDOW_STATUS_CONFIG[windowStatus]?.blocked ?? false, [windowStatus]);
  const windowSurcharge = useMemo(() => windowInfo?.extemporary_surcharge ?? 0, [windowInfo]);

  const fetchAvailable = useCallback(async (overrideDni) => {
    setLoadingAvailable(true);
    try {
      const params = { academic_period: academicPeriod };
      const effectiveDni = overrideDni !== undefined ? overrideDni : dni;
      if (adminMode && effectiveDni.trim()) params.dni = effectiveDni.trim();

      const { data } = await api.get("/academic/enrollments/available", { params });

      const student = pick(data, ["student", "student_info", "profile"], null);
      const list = pick(data, ["courses", "items", "available_courses"], []);
      const win = pick(data, ["enrollment_window", "window"], null);
      const payInfo = data?.payment_status || null;

      setResolvedStudent(student);
      setCourses(Array.isArray(list) ? list : []);
      setWindowInfo(win);
      setPaymentStatus(payInfo);
      setSelectedCourses([]);
      setSelectedSections({});
      setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
      setScheduleConflicts([]);
      setSuggestions([]);

      if (!Array.isArray(list) || !list.length) {
        toast.info("No hay cursos disponibles para este período");
      }
    } catch (e) {
      console.error(e);
      setResolvedStudent(null);
      setCourses([]);
      setWindowInfo(null);
      toast.error(formatApiError(e, "No se pudieron cargar los cursos disponibles"));
    } finally {
      setLoadingAvailable(false);
    }
  }, [api, adminMode, dni, academicPeriod]);

  useEffect(() => {
    if (!adminMode) fetchAvailable();
  }, [adminMode, fetchAvailable]);

  /* ── Callback from roster "Matricular" button ── */
  const handleEnrollFromRoster = useCallback((studentDni, _studentObj) => {
    setDni(studentDni || "");
    setAdminView("individual");
    if (studentDni) {
      setTimeout(() => fetchAvailable(studentDni), 100);
    }
  }, [fetchAvailable]);

  /* ── Course selection ── */
  const addCourseToSelection = (course) => {
    setSelectedCourses((prev) => (prev.find((c) => c.id === course.id) ? prev : [...prev, course]));
    const secs = course.sections || [];
    if (secs.length > 0 && !selectedSections[course.id]) {
      setSelectedSections((prev) => ({ ...prev, [course.id]: secs[0].id }));
    }
  };

  const removeCourseFromSelection = (courseId) => {
    setSelectedCourses((prev) => prev.filter((c) => c.id !== courseId));
    setSelectedSections((prev) => { const next = { ...prev }; delete next[courseId]; return next; });
  };

  const resolvedStudentId = useMemo(
    () => resolvedStudent?.id || resolvedStudent?.student_id || "",
    [resolvedStudent]
  );
  const resolvedDni = useMemo(
    () => resolvedStudent?.dni || resolvedStudent?.num_documento || "",
    [resolvedStudent]
  );

  const buildPayload = () => {
    const payload = {
      academic_period: academicPeriod,
      course_ids: selectedCourses.map((c) => c.id),
    };
    if (resolvedStudentId) payload.student_id = resolvedStudentId;
    if (adminMode && resolvedDni) payload.dni = resolvedDni;
    const secs = {};
    for (const c of selectedCourses) {
      if (selectedSections[c.id]) secs[String(c.id)] = selectedSections[c.id];
    }
    if (Object.keys(secs).length > 0) payload.sections = secs;
    return payload;
  };

  const fetchSuggestions = async () => {
    if (!resolvedStudentId) return toast.error("No se pudo resolver el estudiante");
    try {
      const { data } = await api.post("/academic/enrollments/suggestions", buildPayload());
      const list = data?.suggestions || [];
      setSuggestions(Array.isArray(list) ? list : []);
      if (!list?.length) toast.success("No hay alternativas mejores disponibles");
    } catch (e) {
      toast.error(formatApiError(e, "No se pudieron obtener sugerencias"));
    }
  };

  const validateEnrollment = async () => {
    if (windowBlocked) return toast.error("Matrícula fuera de fecha.");
    if (!resolvedStudentId) return toast.error("No se pudo resolver el estudiante.");
    if (selectedCourses.length === 0) return toast.error("Seleccione al menos un curso para validar");

    setIsValidating(true);
    setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
    setScheduleConflicts([]);
    try {
      const { data } = await api.post("/academic/enrollments/validate", buildPayload());
      setValidation({ status: "success", errors: [], warnings: data?.warnings || [], suggestions: [] });
      toast.success("Validación exitosa. Puede proceder con la matrícula.");
    } catch (err) {
      const status = err?.response?.status;
      const result = err?.response?.data || {};
      if (status === 409) {
        setValidation({ status: "conflict", errors: result.errors || [], warnings: result.warnings || [], suggestions: result.suggestions || [] });
        if (result.schedule_conflicts) setScheduleConflicts(result.schedule_conflicts);
        toast.error("Conflictos detectados en la matrícula");
      } else {
        setValidation({ status: "error", errors: [formatApiError(err, "Error en validación")], warnings: [], suggestions: [] });
        toast.error(formatApiError(err, "Error en la validación de matrícula"));
      }
    } finally {
      setIsValidating(false);
    }
  };

  const commitEnrollment = async () => {
    if (windowBlocked) return toast.error("Matrícula fuera de fecha.");
    if (!resolvedStudentId) return toast.error("No se pudo resolver el estudiante.");
    if (validation.status !== "success") return toast.error("Debe validar la matrícula antes de confirmarla");

    setLoading(true);
    const idempotencyKey = `enrollment-${resolvedStudentId}-${Date.now()}`;
    try {
      const { data } = await api.post("/academic/enrollments/commit", buildPayload(), {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      toast.success("Matrícula realizada exitosamente");
      setSelectedCourses([]);
      setSelectedSections({});
      setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
      setScheduleConflicts([]);
      setSuggestions([]);

      if (data?.enrollment_id) await generateEnrollmentCertificate(data.enrollment_id);

      if (adminMode) {
        setTimeout(() => {
          setRosterKey((k) => k + 1);
          setAdminView("roster");
        }, 1500);
      } else {
        await fetchAvailable();
      }
    } catch (e) {
      console.error(e);
      toast.error(formatApiError(e, "Error al confirmar la matrícula"));
    } finally {
      setLoading(false);
    }
  };

  const generateEnrollmentCertificate = async (enrollmentId) => {
    try {
      const result = await generatePDFWithPolling(
        `/academic/enrollments/${enrollmentId}/certificate`, {},
        { testId: "enrollment-certificate" }
      );
      if (result.success) {
        await downloadFile(result.downloadUrl, `matricula-${enrollmentId}.pdf`);
        toast.success("Constancia de matrícula generada");
      }
    } catch (e) { console.error(e); }
  };

  const generateSchedulePDF = async () => {
    if (!resolvedStudentId) return toast.error("No se pudo resolver el estudiante.");
    try {
      const payload = {
        academic_period: academicPeriod,
        student_id: resolvedStudentId,
      };
      if (adminMode && resolvedDni) payload.dni = resolvedDni;
      if (selectedCourses.length > 0) {
        payload.course_ids = selectedCourses.map((c) => c.id);
        const secs = {};
        for (const c of selectedCourses) {
          if (selectedSections[c.id]) secs[String(c.id)] = selectedSections[c.id];
        }
        if (Object.keys(secs).length > 0) payload.sections = secs;
      }
      const result = await generatePDFWithPolling("/academic/schedules/export", payload, { testId: "schedule-pdf" });
      if (result.success) {
        await downloadFile(result.downloadUrl, `horario-${academicPeriod}.pdf`);
        toast.success("Horario exportado exitosamente");
      }
    } catch (e) { toast.error("Error al exportar horario"); }
  };

  const totalCredits = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + (c.credits || 0), 0),
    [selectedCourses]
  );

  const winCfg = WINDOW_STATUS_CONFIG[windowStatus] || WINDOW_STATUS_CONFIG.FREE;
  const WinIcon = winCfg.Icon;

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Matrícula de Cursos</h2>
          <p className="text-sm text-slate-500">
            Período: <span className="font-semibold text-slate-700">{academicPeriod}</span>
            {adminMode && (
              <Badge className="ml-2 bg-violet-100 text-violet-700 border border-violet-200 text-xs">
                <Shield className="h-3 w-3 mr-1" /> Modo Admin
              </Badge>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={academicPeriod}
              onChange={(e) => setAcademicPeriod(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {generatePeriodOptions().map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {(!adminMode || adminView === "individual") && (
            <Button
              data-testid="schedule-export-pdf"
              variant="outline"
              size="sm"
              onClick={generateSchedulePDF}
              disabled={!resolvedStudent}
              title={!resolvedStudent ? "Cargue un estudiante primero" : "Exportar horario del período"}
            >
              <FileText className="h-4 w-4 mr-2" /> Exportar Horario
            </Button>
          )}
        </div>
      </div>

      {/* ── Admin Tab Switcher ── */}
      {adminMode && (
        <div className="flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setAdminView("roster")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${adminView === "roster"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            <Users className="h-4 w-4" />
            Padrón de Alumnos
          </button>
          <button
            onClick={() => setAdminView("individual")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${adminView === "individual"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            <User className="h-4 w-4" />
            Matrícula Individual
            {resolvedStudent && (
              <Badge className="bg-blue-100 text-blue-700 text-xs ml-1">
                {resolvedStudent?.full_name?.split(" ")[0] || resolvedStudent?.nombres || "Cargado"}
              </Badge>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════
          ADMIN VIEW: ROSTER
          ══════════════════════════════════════ */}
      {adminMode && adminView === "roster" && (
        <StudentsRoster
          key={rosterKey}
          academicPeriod={academicPeriod}
          api={api}
          onEnrollStudent={handleEnrollFromRoster}
        />
      )}

      {/* ══════════════════════════════════════
          INDIVIDUAL ENROLLMENT VIEW
          ══════════════════════════════════════ */}
      {(!adminMode || adminView === "individual") && (
        <>
          {/* ── Controls ── */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              {adminMode ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" /> Cargar alumno por DNI
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="DNI del estudiante"
                      className="w-full sm:w-56"
                      onKeyDown={(e) => e.key === "Enter" && dni.trim() && fetchAvailable()}
                    />
                    <Button onClick={() => fetchAvailable()} disabled={loadingAvailable || !dni.trim()}>
                      {loadingAvailable
                        ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Cargando...</>
                        : <><SearchIcon className="h-4 w-4 mr-2" /> Cargar</>
                      }
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => fetchAvailable()} disabled={loadingAvailable}>
                  {loadingAvailable
                    ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Actualizando...</>
                    : <><SearchIcon className="h-4 w-4 mr-2" /> Actualizar cursos</>
                  }
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ── Student banner + window status ── */}
          {resolvedStudent && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold">
                      {resolvedStudent?.full_name ||
                        resolvedStudent?.name ||
                        `${resolvedStudent?.apellido_paterno || ""} ${resolvedStudent?.apellido_materno || ""} ${resolvedStudent?.nombres || ""}`.trim() ||
                        "Estudiante"}
                    </div>
                    <div className="text-slate-500">
                      DNI: <span className="font-mono">{resolvedStudent?.dni || resolvedStudent?.num_documento || "-"}</span>
                      {resolvedStudent?.plan_name ? (
                        <> · Plan: <span className="font-medium">{resolvedStudent.plan_name}</span></>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-semibold ${winCfg.badgeClass}`}>
                    <WinIcon size={14} />
                    {winCfg.label}
                  </Badge>
                  {windowInfo?.start && windowInfo?.end && (
                    <div className="text-xs text-slate-500">
                      <Calendar size={10} className="inline mr-1" />
                      {formatDate(windowInfo.start)} → {formatDate(windowInfo.end)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── EXTEMPORARY warning ── */}
          {windowStatus === "EXTEMPORARY" && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-amber-800">Período de matrícula extemporánea</div>
                  <div className="text-amber-700 mt-1 space-y-1">
                    <p>El período ordinario ya finalizó. La matrícula está sujeta a un recargo.</p>
                    {windowSurcharge > 0 && (
                      <div className="flex items-center gap-1.5 font-semibold">
                        <DollarSign size={14} />
                        Recargo: <span className="text-amber-900">S/. {Number(windowSurcharge).toFixed(2)}</span>
                      </div>
                    )}
                    {windowInfo?.extemporary_end && (
                      <p className="text-xs opacity-80">Ventana extemporánea hasta: {formatDate(windowInfo.extemporary_end)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── CLOSED block ── */}
          {windowStatus === "CLOSED" && (
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-red-700">Matrícula fuera de fecha</div>
                  <div className="text-red-600/90 mt-1">
                    No es posible validar ni confirmar matrícula. Comunícate con el área académica.
                  </div>
                  {windowInfo?.extemporary_end && (
                    <p className="text-xs text-red-500/80 mt-1">El período extemporáneo finalizó el: {formatDate(windowInfo.extemporary_end)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Payment Gate (solo para estudiantes no-admin) ── */}
          {!adminMode && resolvedStudent && paymentStatus?.status !== "APPROVED" && (
            <EnrollmentPaymentGate
              period={academicPeriod}
              onPaymentApproved={() => fetchAvailable()}
            />
          )}

          {/* ── Course Selection (solo visible si pago aprobado o es admin) ── */}
          <Card className={`border-slate-200 shadow-sm overflow-hidden ${!adminMode && paymentStatus && paymentStatus.status !== "APPROVED" ? "hidden" : ""}`}>
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Library className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-slate-800">Selección de Cursos</CardTitle>
                  <CardDescription>
                    Cursos disponibles para{" "}
                    <span className="font-medium text-slate-700">{academicPeriod}</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {loadingAvailable ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 animate-spin" /> Cargando cursos...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {(Array.isArray(courses) ? courses : []).map((course) => {
                    const selected = selectedCourses.some((c) => c.id === course.id);
                    const scheduleText = normalizeSchedule(course);
                    const isBlocked = course.enabled === false;
                    const blockedLabel = BLOCKED_LABELS[course.blocked_reason] || course.blocked_reason || "";
                    const courseSections = course.sections || [];

                    return (
                      <Card
                        key={course.id}
                        className={`relative transition-all duration-200 group ${isBlocked
                            ? "border-slate-200 bg-slate-50/50 opacity-60"
                            : selected
                              ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10 shadow-sm cursor-pointer"
                              : "border-slate-200 hover:border-blue-300 hover:shadow-md bg-white cursor-pointer"
                          }`}
                      >
                        <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-3">
                              <div className={`p-1.5 rounded-md transition-colors ${isBlocked
                                  ? "bg-slate-100 text-slate-400"
                                  : "bg-slate-100 text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50"
                                }`}>
                                {isBlocked ? <Lock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                              </div>
                              <div className="flex gap-1.5 flex-wrap justify-end">
                                <Badge
                                  variant={selected ? "default" : "secondary"}
                                  className={selected ? "bg-blue-600" : "bg-slate-100 text-slate-600"}
                                >
                                  {course.credits} créditos
                                </Badge>
                                {isBlocked && (
                                  <Badge className="bg-slate-400 text-white text-xs">{blockedLabel}</Badge>
                                )}
                              </div>
                            </div>

                            <h4 className={`font-bold text-base mb-1 leading-tight ${isBlocked ? "text-slate-500" : selected ? "text-blue-700" : "text-slate-800"
                              }`}>
                              {course.name}
                            </h4>

                            {(course?.is_carry || course?.carry || course?.is_backlog) && (
                              <Badge className="mt-2 bg-amber-500">Arrastre</Badge>
                            )}
                            {course?.semester ? (
                              <div className="text-xs text-slate-500 mt-2">Semestre: {course.semester}</div>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <Hash className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-mono text-slate-600">{course.code}</span>
                            </div>

                            {scheduleText ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>{scheduleText}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 px-2">Horario: por sección</div>
                            )}

                            {!isBlocked && courseSections.length > 1 && selected && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-slate-600 mb-1">Sección:</div>
                                <select
                                  value={selectedSections[course.id] || ""}
                                  onChange={(e) =>
                                    setSelectedSections((prev) => ({
                                      ...prev,
                                      [course.id]: parseInt(e.target.value, 10),
                                    }))
                                  }
                                  className="w-full h-8 text-xs rounded-md border border-slate-200 bg-white px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {courseSections.map((sec) => {
                                    const slotStr = sec.slots?.length
                                      ? sec.slots.map((s) => `${s.day} ${s.start}`).join(", ")
                                      : "";
                                    const teacherShort = sec.teacher_name
                                      ? sec.teacher_name.split(" ").slice(-1)[0]
                                      : "";
                                    const label = [
                                      `Sec. ${sec.label}`,
                                      teacherShort,
                                      slotStr,
                                    ].filter(Boolean).join(" · ");
                                    return (
                                      <option key={sec.id} value={sec.id} title={sec.teacher_name}>
                                        {label}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            )}

                            {!isBlocked && courseSections.length === 1 && selected && (
                              <div className="text-xs text-slate-500 px-2 mt-1 flex items-center gap-1">
                                <span className="font-medium">Sec. {courseSections[0].label}</span>
                                {courseSections[0].teacher_name && (
                                  <span className="text-slate-400 truncate">
                                    · {courseSections[0].teacher_name.split(" ").slice(-2).join(" ")}
                                  </span>
                                )}
                              </div>
                            )}

                            {!isBlocked && courseSections.length === 0 && selected && (
                              <div className="text-xs text-slate-400 px-2 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Sección por asignar</span>
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            disabled={isBlocked}
                            onClick={() =>
                              !isBlocked && (selected ? removeCourseFromSelection(course.id) : addCourseToSelection(course))
                            }
                            className={`w-full rounded-xl transition-all ${isBlocked
                                ? "border-slate-200 text-slate-400 cursor-not-allowed"
                                : selected
                                  ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                                  : "border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50"
                              }`}
                          >
                            {isBlocked ? (
                              <><Lock className="h-4 w-4 mr-2" /> {blockedLabel}</>
                            ) : selected ? (
                              <><Check className="h-4 w-4 mr-2" /> Seleccionado</>
                            ) : (
                              <><Plus className="h-4 w-4 mr-2" /> Agregar</>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Selected Summary ── */}
          {selectedCourses.length > 0 && (
            <Card className="border-green-200 bg-green-50/30 shadow-sm">
              <CardHeader className="pb-3 border-b border-green-100">
                <CardTitle className="text-base text-green-800 flex items-center gap-2">
                  <Check className="h-5 w-5 p-1 bg-green-200 rounded-full text-green-700" />
                  Cursos Seleccionados ({selectedCourses.length}) · {totalCredits} créditos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {selectedCourses.map((course) => (
                    <div
                      key={course.id}
                      className="group flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="font-semibold text-slate-800 text-sm">{course.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {course.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-slate-200 text-slate-600 font-normal">
                          {course.credits} cr.
                        </Badge>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => removeCourseFromSelection(course.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Validation Results ── */}
          {validation.status && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {validation.status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {(validation.status === "conflict" || validation.status === "error") && (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Resultado de Validación</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validation.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-600 mb-2">Errores:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.errors.map((error, i) => (
                        <li key={i} className="text-red-600 text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-yellow-600 mb-2">Advertencias:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.warnings.map((w, i) => (
                        <li key={i} className="text-yellow-600 text-sm">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {scheduleConflicts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-600 mb-2">Conflictos de Horario:</h4>
                    <div className="space-y-2">
                      {scheduleConflicts.map((conflict, i) => (
                        <div key={i} className="p-3 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-700">{conflict.message || String(conflict)}</p>
                        </div>
                      ))}
                    </div>
                    <Button
                      data-testid="enroll-suggest-alt"
                      variant="outline"
                      onClick={fetchSuggestions}
                      className="mt-3"
                    >
                      Ver Sugerencias Alternativas
                    </Button>
                    {suggestions.length > 0 && (
                      <div className="mt-3 border rounded p-3">
                        <div className="font-medium mb-2">Alternativas</div>
                        <div className="space-y-2">
                          {suggestions.map((sg, i) => (
                            <div key={i} className="p-2 border rounded">
                              <div className="text-sm">
                                <b>{sg.course_name}</b> · {sg.section_code} · {sg.teacher_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {(Array.isArray(sg.slots) ? sg.slots : [])
                                  .map((k) => `${k.day} ${k.start}-${k.end}`).join(", ")}
                              </div>
                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  setSelectedCourses((prev) => {
                                    const filtered = prev.filter((c) => c.code !== sg.course_code);
                                    return [...filtered, {
                                      id: sg.plan_course_id || sg.course_id,
                                      name: sg.course_name,
                                      code: sg.course_code,
                                      credits: sg.credits,
                                    }];
                                  });
                                  if (sg.section_id) {
                                    setSelectedSections((prev) => ({
                                      ...prev,
                                      [sg.plan_course_id || sg.course_id]: sg.section_id,
                                    }));
                                  }
                                  toast.success("Alternativa aplicada. Vuelva a validar.");
                                }}
                              >
                                Reemplazar por esta opción
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex justify-end gap-3">
            {adminMode && (
              <Button variant="ghost" onClick={() => setAdminView("roster")} className="text-slate-500">
                <ChevronLeft className="h-4 w-4 mr-1" /> Volver al padrón
              </Button>
            )}
            <Button
              data-testid="enroll-validate"
              variant="outline"
              onClick={validateEnrollment}
              disabled={isValidating || selectedCourses.length === 0 || windowBlocked}
            >
              {isValidating
                ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Validando...</>
                : <><SearchIcon className="h-4 w-4 mr-2" /> Validar Matrícula</>
              }
            </Button>
            <Button
              data-testid="enroll-commit"
              onClick={commitEnrollment}
              disabled={loading || validation.status !== "success" || windowBlocked}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading
                ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                : <><CheckCircle className="h-4 w-4 mr-2" /> Confirmar Matrícula</>
              }
            </Button>
          </div>

          <div style={{ display: "none" }}>
            <div data-testid="enrollment-certificate-status">IDLE</div>
            <div data-testid="schedule-pdf-status">IDLE</div>
          </div>
        </>
      )}
    </div>
  );
};

export default EnrollmentComponent;