import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Upload, Save, Send, Lock, Unlock, FileText, Users, Calendar, Clock
} from 'lucide-react';
import { generatePDFWithPolling, generateQRWithPolling, downloadFile } from '../../utils/pdfQrPolling';
import { Attendance } from '../../services/academic.service';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function GradesAttendanceComponent() {
  const { user } = useContext(AuthContext);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [attendanceSessions, setAttendanceSessions] = useState([]);

  const [activeTab, setActiveTab] = useState('grades');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [importDialog, setImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionRows, setSessionRows] = useState([]); // {student_id, status}

  // Grade periods
  const gradePeriods = ['PARCIAL_1', 'PARCIAL_2', 'PARCIAL_3', 'FINAL'];
  const gradeLabels = {
    PARCIAL_1: '1er Parcial',
    PARCIAL_2: '2do Parcial',
    PARCIAL_3: '3er Parcial',
    FINAL: 'Examen Final'
  };

  // Attendance states
  const attendanceStates = {
    PRESENT: { label: 'Presente', color: 'bg-green-500' },
    ABSENT: { label: 'Ausente', color: 'bg-red-500' },
    LATE: { label: 'Tardanza', color: 'bg-yellow-500' },
    EXCUSED: { label: 'Justificado', color: 'bg-blue-500' }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchTeacherSections();
  }, [user?.id]);

  useEffect(() => {
    if (selectedSection?.id) {
      fetchSectionStudents();
      fetchGrades();
      fetchAttendanceSessions();
    }
  }, [selectedSection?.id]);

  const showToast = (type, message) => {
    const toastElement = document.createElement('div');
    toastElement.setAttribute('data-testid', `toast-${type}`);
    toastElement.textContent = message;
    document.body.appendChild(toastElement);

    toast[type](message);

    setTimeout(() => {
      if (document.body.contains(toastElement)) {
        document.body.removeChild(toastElement);
      }
    }, 5000);
  };

  const fetchTeacherSections = async () => {
    try {
      const response = await fetch(`${API}/teachers/${user.id}/sections`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSections(data.sections || []);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      showToast('error', 'Error al cargar secciones');
    }
  };

  const fetchSectionStudents = async () => {
    try {
      const response = await fetch(`${API}/sections/${selectedSection.id}/students`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      showToast('error', 'Error al cargar estudiantes');
    }
  };

  const fetchGrades = async () => {
    try {
      const response = await fetch(`${API}/sections/${selectedSection.id}/grades`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGrades(data.grades || {});
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
      showToast('error', 'Error al cargar calificaciones');
    }
  };

  const fetchAttendanceSessions = async () => {
    try {
      const d = await Attendance.listSessions(selectedSection.id);
      setAttendanceSessions(d?.sessions || d || []);
    } catch (e) { showToast('error', 'Error al cargar sesiones'); }
  };

  const createAttendanceSession = async () => {
    try {
      const r = await Attendance.createSession(selectedSection.id, { date: sessionDate });
      const ses = r?.session || r;
      setCurrentSession(ses);
      const rows = students.map(s => ({ student_id: s.id, status: 'PRESENT' }));
      setSessionRows(rows);
      await fetchAttendanceSessions();
      showToast('success', 'Sesión creada');
    } catch (e) { showToast('error', e.message || 'No se pudo crear la sesión'); }
  };

  const setRowStatus = (studentId, status) => {
    setSessionRows(prev => prev.map(r => r.student_id === studentId ? { ...r, status } : r));
  };

  const saveAttendance = async () => {
    if (!currentSession) return;
    try {
      await Attendance.set(selectedSection.id, currentSession.id, sessionRows);
      showToast('success', 'Asistencia guardada');
    } catch (e) { showToast('error', e.message || 'Error al guardar asistencia'); }
  };

  const closeAttendance = async () => {
    if (!currentSession) return;
    try {
      await Attendance.set(selectedSection.id, currentSession.id, sessionRows);
      await Attendance.closeSession(selectedSection.id, currentSession.id);
      setCurrentSession(null); setSessionRows([]);
      await fetchAttendanceSessions();
      showToast('success', 'Sesión cerrada');
    } catch (e) { showToast('error', e.message || 'Error al cerrar sesión'); }
  };

  const updateGrade = (studentId, period, value) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 20) return;
    setGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [period]: numericValue } }));
  };

  const saveGrades = async () => {
    if (!selectedSection) return showToast('error', 'Seleccione una sección');
    setIsSaving(true);
    try {
      const payload = { section_id: selectedSection.id, grades };
      const response = await fetch(`${API}/grades/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });
      if (response.ok) showToast('success', 'Calificaciones guardadas');
      else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al guardar calificaciones');
      }
    } catch (error) {
      console.error('Save grades error:', error);
      showToast('error', error.message || 'Error al guardar calificaciones');
    } finally { setIsSaving(false); }
  };

  const submitGrades = async () => {
    if (!selectedSection) return showToast('error', 'Seleccione una sección');

    const missing = students.some(st => {
      const sg = grades[st.id] || {};
      return gradePeriods.some(p => sg[p] === undefined || sg[p] === null);
    });
    if (missing) return showToast('error', 'Complete todas las calificaciones antes de enviar');

    setIsSubmitting(true);
    try {
      const payload = { section_id: selectedSection.id, grades };
      const response = await fetch(`${API}/grades/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        showToast('success', 'Calificaciones enviadas y cerradas');
        await generateActaPDF();
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al enviar calificaciones');
      }
    } catch (error) {
      console.error('Submit grades error:', error);
      showToast('error', error.message || 'Error al enviar calificaciones');
    } finally { setIsSubmitting(false); }
  };

  const reopenGrades = async () => {
    if (!selectedSection) return showToast('error', 'Seleccione una sección');
    const confirmElement = document.createElement('div');
    confirmElement.setAttribute('data-testid', 'dialog-confirm');
    confirmElement.textContent = 'Confirmar reapertura';
    document.body.appendChild(confirmElement);
    if (!window.confirm('¿Está seguro de reabrir las calificaciones?')) {
      document.body.removeChild(confirmElement);
      return;
    }
    try {
      const response = await fetch(`${API}/grades/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ section_id: selectedSection.id })
      });
      if (response.ok) {
        showToast('success', 'Calificaciones reabiertas');
        await fetchGrades();
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al reabrir calificaciones');
      }
    } catch (error) {
      console.error('Reopen grades error:', error);
      showToast('error', error.message || 'Error al reabrir calificaciones');
    } finally { document.body.removeChild(confirmElement); }
  };

  const generateActaPDF = async () => {
    try {
      const result = await generatePDFWithPolling(`/sections/${selectedSection.id}/acta`, {}, { testId: 'acta-pdf' });
      if (result.success) {
        await downloadFile(result.downloadUrl, `acta-${selectedSection.course_code}-${selectedSection.id}.pdf`);
        showToast('success', 'Acta PDF generada');
        await generateActaQR();
      }
    } catch (error) {
      console.error('Acta PDF generation error:', error);
      showToast('error', 'Error al generar acta PDF');
    }
  };

  const generateActaQR = async () => {
    try {
      const result = await generateQRWithPolling(`/sections/${selectedSection.id}/acta/qr`, {}, { testId: 'acta-qr-code' });
      if (result.success) showToast('success', 'Código QR generado');
    } catch (error) {
      console.error('Acta QR generation error:', error);
      showToast('error', 'Error al generar código QR');
    }
  };

  const importAttendanceCSV = async () => {
    if (!csvFile) return showToast('error', 'Seleccione un archivo CSV');
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('section_id', selectedSection.id);
    try {
      const response = await fetch(`${API}/attendance/import/preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const result = await response.json();
      if (response.ok) {
        setImportPreview(result.preview || []);
        setImportErrors(result.errors || []);
        if (result.errors?.length) showToast('error', `${result.errors.length} errores en el archivo`);
        else showToast('success', 'Vista previa generada');
      } else {
        throw new Error(result.detail || 'Error al procesar archivo');
      }
    } catch (error) {
      console.error('CSV import error:', error);
      showToast('error', error.message || 'Error al importar asistencia');
    }
  };

  const saveAttendanceImport = async () => {
    if (importErrors.length > 0) return showToast('error', 'Corrija los errores antes de guardar');
    try {
      const response = await fetch(`${API}/attendance/import/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ section_id: selectedSection.id, attendance_data: importPreview })
      });
      if (response.ok) {
        showToast('success', 'Asistencia importada');
        setImportDialog(false);
        setImportPreview([]); setImportErrors([]); setCsvFile(null);
        await fetchAttendanceSessions();
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al guardar asistencia');
      }
    } catch (error) {
      console.error('Save attendance error:', error);
      showToast('error', error.message || 'Error al guardar asistencia');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Calificaciones y Asistencia</h2>

        {/* Section Selector */}
        <div className="flex items-center space-x-4">
          <Label htmlFor="section-select">Sección:</Label>
          <Select
            value={selectedSection?.id ? String(selectedSection.id) : ''}
            onValueChange={(value) => {
              const section = sections.find(s => String(s.id) === value);
              setSelectedSection(section || null);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Seleccionar sección" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={String(section.id)}>
                  {section.course_name} - {section.section_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSection && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="grades">Calificaciones</TabsTrigger>
            <TabsTrigger value="attendance">Asistencia</TabsTrigger>
          </TabsList>

          {/* Grades Tab */}
          <TabsContent value="grades">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Registro de Calificaciones</CardTitle>
                    <CardDescription>
                      Sección: {selectedSection.course_name} - {selectedSection.section_code}
                    </CardDescription>
                  </div>

                  <div className="flex space-x-2">
                    <Button data-testid="grade-save" variant="outline" onClick={saveGrades} disabled={isSaving}>
                      {isSaving ? (<><Clock className="h-4 w-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="h-4 w-4 mr-2" />Guardar</>)}
                    </Button>

                    <Button data-testid="grade-submit" onClick={submitGrades} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? (<><Clock className="h-4 w-4 mr-2 animate-spin" />Enviando...</>) : (<><Send className="h-4 w-4 mr-2" />Enviar y Cerrar</>)}
                    </Button>

                    {(user?.role === 'REGISTRAR' || user?.role === 'ADMIN_ACADEMIC') ? (
                      <Button data-testid="grade-reopen" variant="outline" onClick={reopenGrades}>
                        <Unlock className="h-4 w-4 mr-2" />Reabrir
                      </Button>
                    ) : null}

                    <Button data-testid="act-generate-pdf" variant="outline" onClick={generateActaPDF}>
                      <FileText className="h-4 w-4 mr-2" />Generar Acta
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Tabla simple de notas */}
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Estudiante</th>
                        {gradePeriods.map(p => <th key={p} className="p-2 text-center">{gradeLabels[p]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(st => {
                        const sg = grades[st.id] || {};
                        return (
                          <tr key={st.id} className="border-t">
                            <td className="p-2">{st.first_name} {st.last_name}</td>
                            {gradePeriods.map(p => (
                              <td key={p} className="p-2 text-center">
                                <Input
                                  type="number" min="0" max="20" step="1"
                                  className="w-20 text-center"
                                  value={sg[p] ?? ""}
                                  onChange={(e) => updateGrade(st.id, p, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {students.length === 0 && (
                        <tr><td className="p-3 text-center text-gray-500" colSpan={1 + gradePeriods.length}>Sin estudiantes</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-end gap-3">
                  <div>
                    <Label>Fecha de sesión</Label>
                    <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
                  </div>
                  <Button onClick={createAttendanceSession}><Calendar className="h-4 w-4 mr-2" />Nueva sesión</Button>
                </div>

                {/* Sesiones existentes */}
                <div className="border rounded">
                  <div className="p-2 font-medium bg-gray-50">Sesiones registradas</div>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50"><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Estado</th></tr></thead>
                      <tbody>
                        {(attendanceSessions || []).map(s => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{s.date}</td>
                            <td className="p-2">{s.is_closed ? <Badge variant="secondary">Cerrada</Badge> : <Badge>Abierta</Badge>}</td>
                          </tr>
                        ))}
                        {(!attendanceSessions || attendanceSessions.length === 0) && (
                          <tr><td className="p-3 text-center text-gray-500" colSpan={2}>Sin sesiones</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Edición de la sesión actual */}
                {currentSession && (
                  <div className="border rounded p-3 space-y-3">
                    <div className="font-medium">Tomando asistencia — {currentSession.date}</div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left">Estudiante</th>
                            <th className="p-2 text-left">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(st => {
                            const row = sessionRows.find(r => r.student_id === st.id) || { status: 'PRESENT' };
                            return (
                              <tr key={st.id} className="border-t">
                                <td className="p-2">{st.first_name} {st.last_name}</td>
                                <td className="p-2">
                                  <Select value={row.status} onValueChange={(v) => setRowStatus(st.id, v)}>
                                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="PRESENT">Presente</SelectItem>
                                      <SelectItem value="ABSENT">Ausente</SelectItem>
                                      <SelectItem value="LATE">Tardanza</SelectItem>
                                      <SelectItem value="EXCUSED">Justificado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={saveAttendance}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                      <Button onClick={closeAttendance} className="bg-blue-600 hover:bg-blue-700"><Lock className="h-4 w-4 mr-2" />Cerrar sesión</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Control de Asistencia</CardTitle>
                    <CardDescription>
                      Sección: {selectedSection.course_name} - {selectedSection.section_code}
                    </CardDescription>
                  </div>

                  <div className="flex space-x-2">
                    <Dialog open={importDialog} onOpenChange={setImportDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="attendance-import" variant="outline">
                          <Upload className="h-4 w-4 mr-2" />
                          Importar CSV
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Importar Asistencia desde CSV</DialogTitle>
                          <DialogDescription>Seleccione un archivo CSV con los datos de asistencia</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="csv-file">Archivo CSV</Label>
                            <Input id="csv-file" type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} />
                          </div>

                          <Button onClick={importAttendanceCSV} disabled={!csvFile}>
                            <FileText className="h-4 w-4 mr-2" />
                            Generar Vista Previa
                          </Button>

                          {importErrors.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-red-600 mb-2">Errores encontrados ({importErrors.length}):</h4>
                              <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded">
                                {importErrors.map((error, index) => (
                                  <p key={index} className="text-sm text-red-700">Fila {error.row}: {error.message}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {importPreview.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Vista Previa ({importPreview.length} registros):</h4>
                              <div className="max-h-60 overflow-auto border rounded">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="p-2 text-left">Estudiante</th>
                                      <th className="p-2 text-left">Fecha</th>
                                      <th className="p-2 text-left">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {importPreview.slice(0, 10).map((record, index) => (
                                      <tr key={index} className="border-t">
                                        <td className="p-2">{record.student_name}</td>
                                        <td className="p-2">{record.date}</td>
                                        <td className="p-2">
                                          <Badge className={attendanceStates[record.status]?.color}>
                                            {attendanceStates[record.status]?.label}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {importPreview.length > 10 && (
                                  <p className="p-2 text-center text-gray-500">
                                    ... y {importPreview.length - 10} registros más
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end space-x-2">
                            <Button data-testid="dialog-cancel" variant="outline" onClick={() => setImportDialog(false)}>
                              Cancelar
                            </Button>
                            <Button data-testid="attendance-save" onClick={saveAttendanceImport} disabled={importPreview.length === 0 || importErrors.length > 0}>
                              <Save className="h-4 w-4 mr-2" />
                              Guardar Asistencia
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Seleccione "Importar CSV" para cargar datos de asistencia</p>
                  <p className="text-sm mt-2">O implemente el registro manual de asistencia aquí</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Status indicators for E2E testing */}
      <div style={{ display: 'none' }}>
        <div data-testid="acta-pdf-status">IDLE</div>
        <div data-testid="acta-qr-status">IDLE</div>
        <img data-testid="acta-qr-code" data-status="idle" alt="QR Code" />
      </div>
    </div>
  );
}
