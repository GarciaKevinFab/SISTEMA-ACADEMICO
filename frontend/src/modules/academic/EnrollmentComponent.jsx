// src/modules/academic/EnrollmentComponent.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, Clock, Plus, Search as SearchIcon, FileText } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";

/* ---------------- helpers ---------------- */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d.map((e) => {
        const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
        return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

const EnrollmentComponent = () => {
  const { user, api } = useAuth();

  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);

  const [enrollmentData, setEnrollmentData] = useState({
    student_id: user?.id || "",
    academic_period: "2025-I",
    selected_courses: [],
  });

  const [validation, setValidation] = useState({
    status: null,
    errors: [],
    warnings: [],
    suggestions: [],
  });

  const [loading, setLoading] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);

  const [suggestions, setSuggestions] = useState([]);

  // ---- define fetchAvailableCourses ANTES del efecto que lo usa
  const fetchAvailableCourses = useCallback(async () => {
    try {
      const { data } = await api.get("/courses/available");
      setCourses(data?.courses ?? data ?? []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      showToast("error", formatApiError(error, "Error al cargar cursos disponibles"));
    }
  }, [api]);

  useEffect(() => { fetchAvailableCourses(); }, [fetchAvailableCourses]);

  // Si el user llega más tarde, sincroniza el student_id
  useEffect(() => {
    setEnrollmentData((d) => ({ ...d, student_id: user?.id || "" }));
  }, [user?.id]);

  const showToast = (type, message) => {
    const toastElement = document.createElement("div");
    toastElement.setAttribute("data-testid", `toast-${type}`);
    toastElement.textContent = message;
    document.body.appendChild(toastElement);
    toast[type](message);
    setTimeout(() => { if (toastElement.parentNode) document.body.removeChild(toastElement); }, 5000);
  };

  const fetchSuggestions = async () => {
    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map(c => c.id),
    };
    try {
      const d = await api.post("/enrollments/suggestions", payload);
      const list = d?.data?.suggestions || d?.suggestions || [];
      setSuggestions(list);
      if (!list.length) showToast("success", "No hay alternativas mejores disponibles");
    } catch (e) { showToast("error", formatApiError(e, "No se pudieron obtener sugerencias")); }
  };

  const validateEnrollment = async () => {
    if (selectedCourses.length === 0) {
      showToast("error", "Seleccione al menos un curso para validar");
      return;
    }
    setIsValidating(true);
    setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
    setScheduleConflicts([]);

    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map((c) => c.id),
    };

    try {
      const { data } = await api.post("/enrollments/validate", payload);
      setValidation({
        status: "success",
        errors: [],
        warnings: data?.warnings || [],
        suggestions: [],
      });
      showToast("success", "Validación exitosa. Puede proceder con la matrícula.");
    } catch (err) {
      const status = err?.response?.status;
      const result = err?.response?.data || {};
      if (status === 409) {
        setValidation({
          status: "conflict",
          errors: result.errors || [],
          warnings: result.warnings || [],
          suggestions: result.suggestions || [],
        });
        if (result.schedule_conflicts) setScheduleConflicts(result.schedule_conflicts);
        showToast("error", "Conflictos detectados en la matrícula");
      } else {
        setValidation({
          status: "error",
          errors: [formatApiError(err, "Error en validación")],
          warnings: [],
          suggestions: [],
        });
        showToast("error", "Error en la validación de matrícula");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const commitEnrollment = async () => {
    if (validation.status !== "success") {
      showToast("error", "Debe validar la matrícula antes de confirmarla");
      return;
    }
    setLoading(true);
    const idempotencyKey = `enrollment-${user?.id ?? "anon"}-${Date.now()}`;

    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map((c) => c.id),
    };

    try {
      const { data } = await api.post("/enrollments/commit", payload, {
        headers: { "Idempotency-Key": idempotencyKey },
      });

      showToast("success", "Matrícula realizada exitosamente");

      // Reset
      setSelectedCourses([]);
      setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
      setScheduleConflicts([]);

      if (data?.enrollment_id) {
        await generateEnrollmentCertificate(data.enrollment_id);
      }
    } catch (error) {
      console.error("Enrollment commit error:", error);
      showToast("error", formatApiError(error, "Error al confirmar la matrícula"));
    } finally {
      setLoading(false);
    }
  };

  const generateEnrollmentCertificate = async (enrollmentId) => {
    try {
      const result = await generatePDFWithPolling(
        `/enrollments/${enrollmentId}/certificate`,
        {},
        { testId: "enrollment-certificate" }
      );
      if (result.success) {
        await downloadFile(result.downloadUrl, `matricula-${enrollmentId}.pdf`);
        showToast("success", "Constancia de matrícula generada");
      }
    } catch (error) {
      console.error("Certificate generation error:", error);
      showToast("error", "Error al generar constancia de matrícula");
    }
  };

  const generateSchedulePDF = async () => {
    if (selectedCourses.length === 0) {
      showToast("error", "Seleccione cursos para generar horario");
      return;
    }
    try {
      const result = await generatePDFWithPolling(
        "/schedules/export",
        {
          student_id: enrollmentData.student_id,
          academic_period: enrollmentData.academic_period,
          course_ids: selectedCourses.map((c) => c.id),
        },
        { testId: "schedule-pdf" }
      );
      if (result.success) {
        await downloadFile(result.downloadUrl, `horario-${enrollmentData.academic_period}.pdf`);
        showToast("success", "Horario exportado exitosamente");
      }
    } catch (error) {
      console.error("Schedule export error:", error);
      showToast("error", "Error al exportar horario");
    }
  };

  const addCourseToSelection = (course) => {
    setSelectedCourses((prev) => (prev.find((c) => c.id === course.id) ? prev : [...prev, course]));
  };
  const removeCourseFromSelection = (courseId) => {
    setSelectedCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  return (
   <div className="space-y-6 pb-24 sm:pb-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Matrícula de Cursos</h2>
        <div className="flex space-x-2">
          <Button data-testid="schedule-export-pdf" variant="outline" onClick={generateSchedulePDF} disabled={selectedCourses.length === 0}>
            <FileText className="h-4 w-4 mr-2" /> Exportar Horario
          </Button>
        </div>
      </div>

      {/* Course Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selección de Cursos</CardTitle>
          <CardDescription>Seleccione los cursos para el período académico {enrollmentData.academic_period}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.isArray(courses) ? courses : []).map((course) => {
              const selected = selectedCourses.some((c) => c.id === course.id);
              return (
                <Card key={course.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-sm">{course.name}</h4>
                      <Badge variant="outline">{course.credits} créditos</Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{course.code}</p>
                    <p className="text-xs text-gray-500 mb-3">{course.schedule}</p>

                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => (selected ? removeCourseFromSelection(course.id) : addCourseToSelection(course))}
                      className="w-full"
                    >
                      {selected ? "Seleccionado" : "Seleccionar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected */}
      {selectedCourses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cursos Seleccionados ({selectedCourses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedCourses.map((course) => (
                <div key={course.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{course.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({course.code})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge>{course.credits} créditos</Badge>
                    <Button size="sm" variant="ghost" onClick={() => removeCourseFromSelection(course.id)}>×</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validation.status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {validation.status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {(validation.status === "conflict" || validation.status === "error") && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span>Resultado de Validación</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validation.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Errores:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-red-600 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-yellow-600 mb-2">Advertencias:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-yellow-600 text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {scheduleConflicts.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Conflictos de Horario:</h4>
                <div className="space-y-2">
                  {scheduleConflicts.map((conflict, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">{conflict.message}</p>
                    </div>
                  ))}
                </div>

                <Button data-testid="enroll-suggest-alt" variant="outline" onClick={fetchSuggestions} className="mt-3">
                  Ver Sugerencias Alternativas
                </Button>
                {suggestions.length > 0 && (
                  <div className="mt-3 border rounded p-3">
                    <div className="font-medium mb-2">Alternativas</div>
                    <div className="space-y-2">
                      {suggestions.map((sg, i) => (
                        <div key={i} className="p-2 border rounded">
                          <div className="text-sm"><b>{sg.course_name}</b> · {sg.section_code} · {sg.teacher_name}</div>
                          <div className="text-xs text-gray-500">{(Array.isArray(sg.slots) ? sg.slots : []).map(k => `${k.day} ${k.start}-${k.end}`).join(", ")}</div>
                          <div className="text-xs text-gray-500">Cupo: {sg.available} / {sg.capacity}</div>
                          <div className="mt-2">
                            <Button size="sm" onClick={() => {
                              setSelectedCourses(prev => {
                                const filtered = prev.filter(c => c.code !== sg.course_code);
                                return [...filtered, { id: sg.course_id, name: sg.course_name, code: sg.course_code, credits: sg.credits, schedule: (Array.isArray(sg.slots) ? sg.slots : []).map(k => `${k.day} ${k.start}-${k.end}`).join(', ') }];
                              });
                              showToast("success", "Alternativa aplicada. Vuelva a validar.");
                            }}>
                              Reemplazar por esta opción
                            </Button>
                          </div>
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

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button
          data-testid="enroll-validate"
          variant="outline"
          onClick={validateEnrollment}
          disabled={isValidating || selectedCourses.length === 0}
        >
          {isValidating ? (<><Clock className="h-4 w-4 mr-2 animate-spin" /> Validando...</>) : (<><SearchIcon className="h-4 w-4 mr-2" /> Validar Matrícula</>)}
        </Button>

        <Button
          data-testid="enroll-commit"
          onClick={commitEnrollment}
          disabled={loading || validation.status !== "success"}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (<><Clock className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>) : (<><CheckCircle className="h-4 w-4 mr-2" /> Confirmar Matrícula</>)}
        </Button>
      </div>

      {/* Status indicators E2E */}
      <div style={{ display: "none" }}>
        <div data-testid="enrollment-certificate-status">IDLE</div>
        <div data-testid="schedule-pdf-status">IDLE</div>
      </div>
    </div>
  );
};

export default EnrollmentComponent;
