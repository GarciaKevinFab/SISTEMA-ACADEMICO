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
  Upload,
  Download,
  Save,
  Send,
  Lock,
  Unlock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Users,
  Calendar,
  Clock,
  Award
} from 'lucide-react';
import { generatePDFWithPolling, generateQRWithPolling, downloadFile } from '../../utils/pdfQrPolling';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GradesAttendanceComponent = () => {
  const { user } = useContext(AuthContext);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [attendance, setAttendance] = useState({});
  const [attendanceSessions, setAttendanceSessions] = useState([]);

  const [activeTab, setActiveTab] = useState('grades');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [importDialog, setImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);

  // Grade periods
  const gradePeriods = ['PARCIAL_1', 'PARCIAL_2', 'PARCIAL_3', 'FINAL'];
  const gradeLabels = {
    'PARCIAL_1': '1er Parcial',
    'PARCIAL_2': '2do Parcial',
    'PARCIAL_3': '3er Parcial',
    'FINAL': 'Examen Final'
  };

  // Attendance states
  const attendanceStates = {
    'PRESENT': { label: 'Presente', color: 'bg-green-500' },
    'ABSENT': { label: 'Ausente', color: 'bg-red-500' },
    'LATE': { label: 'Tardanza', color: 'bg-yellow-500' },
    'EXCUSED': { label: 'Justificado', color: 'bg-blue-500' }
  };

  useEffect(() => {
    fetchTeacherSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      fetchSectionStudents();
      fetchGrades();
      fetchAttendanceSessions();
    }
  }, [selectedSection]);

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
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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
    if (!selectedSection) return;

    try {
      const response = await fetch(`${API}/sections/${selectedSection.id}/students`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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
    if (!selectedSection) return;

    try {
      const response = await fetch(`${API}/sections/${selectedSection.id}/grades`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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
    if (!selectedSection) return;

    try {
      const response = await fetch(`${API}/sections/${selectedSection.id}/attendance/sessions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching attendance sessions:', error);
      showToast('error', 'Error al cargar sesiones de asistencia');
    }
  };

  const updateGrade = (studentId, period, value) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 20) {
      return;
    }

    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [period]: numericValue
      }
    }));
  };

  const saveGrades = async () => {
    if (!selectedSection) {
      showToast('error', 'Seleccione una sección');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        section_id: selectedSection.id,
        grades: grades
      };

      const response = await fetch(`${API}/grades/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast('success', 'Calificaciones guardadas exitosamente');
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al guardar calificaciones');
      }
    } catch (error) {
      console.error('Save grades error:', error);
      showToast('error', error.message || 'Error al guardar calificaciones');
    } finally {
      setIsSaving(false);
    }
  };

  const submitGrades = async () => {
    if (!selectedSection) {
      showToast('error', 'Seleccione una sección');
      return;
    }

    // Validate all grades are entered
    const missingGrades = students.some(student => {
      const studentGrades = grades[student.id] || {};
      return gradePeriods.some(period =>
        studentGrades[period] === undefined || studentGrades[period] === null
      );
    });

    if (missingGrades) {
      showToast('error', 'Complete todas las calificaciones antes de enviar');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        section_id: selectedSection.id,
        grades: grades
      };

      const response = await fetch(`${API}/grades/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast('success', 'Calificaciones enviadas y cerradas exitosamente');

        // Generate acta automatically
        await generateActaPDF();

      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al enviar calificaciones');
      }
    } catch (error) {
      console.error('Submit grades error:', error);
      showToast('error', error.message || 'Error al enviar calificaciones');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reopenGrades = async () => {
    if (!selectedSection) {
      showToast('error', 'Seleccione una sección');
      return;
    }

    // Confirm action
    const confirmElement = document.createElement('div');
    confirmElement.setAttribute('data-testid', 'dialog-confirm');
    confirmElement.textContent = 'Confirmar reapertura';
    document.body.appendChild(confirmElement);

    if (!window.confirm('¿Está seguro de reabrir las calificaciones? Esta acción requiere permisos especiales.')) {
      document.body.removeChild(confirmElement);
      return;
    }

    try {
      const response = await fetch(`${API}/grades/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          section_id: selectedSection.id
        })
      });

      if (response.ok) {
        showToast('success', 'Calificaciones reabiertas exitosamente');
        await fetchGrades(); // Refresh grades
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Error al reabrir calificaciones');
      }
    } catch (error) {
      console.error('Reopen grades error:', error);
      showToast('error', error.message || 'Error al reabrir calificaciones');
    } finally {
      document.body.removeChild(confirmElement);
    }
  };

  const generateActaPDF = async () => {
    if (!selectedSection) {
      showToast('error', 'Seleccione una sección');
      return;
    }

    try {
      const result = await generatePDFWithPolling(
        `/sections/${selectedSection.id}/acta`,
        {},
        { testId: 'acta-pdf' }
      );

      if (result.success) {
        await downloadFile(result.downloadUrl, `acta-${selectedSection.course_code}-${selectedSection.id}.pdf`);
        showToast('success', 'Acta PDF generada exitosamente');

        // Generate QR for verification
        await generateActaQR();
      }
    } catch (error) {
      console.error('Acta PDF generation error:', error);
      showToast('error', 'Error al generar acta PDF');
    }
  };

  const generateActaQR = async () => {
    if (!selectedSection) return;

    try {
      const result = await generateQRWithPolling(
        `/sections/${selectedSection.id}/acta/qr`,
        {},
        { testId: 'acta-qr-code' }
      );

      if (result.success) {
        showToast('success', 'Código QR de verificación generado');
      }
    } catch (error) {
      console.error('Acta QR generation error:', error);
      showToast('error', 'Error al generar código QR');
    }
  };

  const importAttendanceCSV = async () => {
    if (!csvFile) {
      showToast('error', 'Seleccione un archivo CSV');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('section_id', selectedSection.id);

    try {
      const response = await fetch(`${API}/attendance/import/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setImportPreview(result.preview || []);
        setImportErrors(result.errors || []);

        if (result.errors && result.errors.length > 0) {
          showToast('error', `${result.errors.length} errores encontrados en el archivo`);
        } else {
          showToast('success', 'Vista previa generada exitosamente');
        }
      } else {
        throw new Error(result.detail || 'Error al procesar archivo');
      }
    } catch (error) {
      console.error('CSV import error:', error);
      showToast('error', error.message || 'Error al importar asistencia');
    }
  };

  const saveAttendanceImport = async () => {
    if (importErrors.length > 0) {
      showToast('error', 'Corrija los errores antes de guardar');
      return;
    }

    try {
      const response = await fetch(`${API}/attendance/import/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          section_id: selectedSection.id,
          attendance_data: importPreview
        })
      });

      if (response.ok) {
        showToast('success', 'Asistencia importada exitosamente');
        setImportDialog(false);
        setImportPreview([]);
        setImportErrors([]);
        setCsvFile(null);
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

  const convertGradeToLetter = (numericGrade) => {
    if (numericGrade >= 18) return 'AD';
    if (numericGrade >= 14) return 'A';
    if (numericGrade >= 11) return 'B';
    return 'C';
  };

  const calculateFinalGrade = (studentGrades) => {
    const parcial1 = studentGrades?.PARCIAL_1 || 0;
    const parcial2 = studentGrades?.PARCIAL_2 || 0;
    const parcial3 = studentGrades?.PARCIAL_3 || 0;
    const final = studentGrades?.FINAL || 0;

    // Average of 3 parcials (60%) + final exam (40%)
    const parcialAverage = (parcial1 + parcial2 + parcial3) / 3;
    const finalGrade = (parcialAverage * 0.6) + (final * 0.4);

    return Math.round(finalGrade * 100) / 100; // Round to 2 decimals
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
            value={selectedSection?.id || ''}
            onValueChange={(value) => {
              const section = sections.find(s => s.id === value);
              setSelectedSection(section);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Seleccionar sección" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
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
                    <Button
                      data-testid="grade-save"
                      variant="outline"
                      onClick={saveGrades}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar
                        </>
                      )}
                    </Button>

                    <Button
                      data-testid="grade-submit"
                      onClick={submitGrades}
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar y Cerrar
                        </>
                      )}
                    </Button>

                    {user?.role === 'REGISTRAR' || user?.role === 'ADMIN_ACADEMIC' ? (
                      <Button
                        data-testid="grade-reopen"
                        variant="outline"
                        onClick={reopenGrades}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Reabrir
                      </Button>
                    ) : null}

                    <Button
                      data-testid="act-generate-pdf"
                      variant="outline"
                      onClick={generateActaPDF}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Acta
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-2 text-left">Estudiante</th>
                        {gradePeriods.map(period => (
                          <th key={period} className="border border-gray-300 p-2 text-center min-w-[100px]">
                            {gradeLabels[period]}
                          </th>
                        ))}
                        <th className="border border-gray-300 p-2 text-center">Promedio Final</th>
                        <th className="border border-gray-300 p-2 text-center">Letra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const studentGrades = grades[student.id] || {};
                        const finalGrade = calculateFinalGrade(studentGrades);

                        return (
                          <tr key={student.id}>
                            <td className="border border-gray-300 p-2">
                              {student.first_name} {student.last_name}
                            </td>

                            {gradePeriods.map(period => (
                              <td key={period} className="border border-gray-300 p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.5"
                                  value={studentGrades[period] || ''}
                                  onChange={(e) => updateGrade(student.id, period, e.target.value)}
                                  className="w-full text-center"
                                  placeholder="0-20"
                                />
                              </td>
                            ))}

                            <td className="border border-gray-300 p-2 text-center font-bold">
                              {finalGrade.toFixed(2)}
                            </td>

                            <td className="border border-gray-300 p-2 text-center">
                              <Badge
                                variant={finalGrade >= 11 ? "default" : "destructive"}
                              >
                                {convertGradeToLetter(finalGrade)}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                          <DialogDescription>
                            Seleccione un archivo CSV con los datos de asistencia
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="csv-file">Archivo CSV</Label>
                            <Input
                              id="csv-file"
                              type="file"
                              accept=".csv"
                              onChange={(e) => setCsvFile(e.target.files[0])}
                            />
                          </div>

                          <Button onClick={importAttendanceCSV} disabled={!csvFile}>
                            <FileText className="h-4 w-4 mr-2" />
                            Generar Vista Previa
                          </Button>

                          {importErrors.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-red-600 mb-2">
                                Errores encontrados ({importErrors.length}):
                              </h4>
                              <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded">
                                {importErrors.map((error, index) => (
                                  <p key={index} className="text-sm text-red-700">
                                    Fila {error.row}: {error.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {importPreview.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">
                                Vista Previa ({importPreview.length} registros):
                              </h4>
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
                                          <Badge
                                            className={attendanceStates[record.status]?.color}
                                          >
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
                            <Button
                              data-testid="dialog-cancel"
                              variant="outline"
                              onClick={() => setImportDialog(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              data-testid="attendance-save"
                              onClick={saveAttendanceImport}
                              disabled={importPreview.length === 0 || importErrors.length > 0}
                            >
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
                  <p className="text-sm mt-2">
                    O implemente el registro manual de asistencia aquí
                  </p>
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
};

export default GradesAttendanceComponent;