import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Plus,
  Search,
  FileText,
  Download
} from 'lucide-react';
import { generatePDFWithPolling, downloadFile } from '../utils/pdfQrPolling';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EnrollmentComponent = () => {
  const { user } = useContext(AuthContext);
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [enrollmentData, setEnrollmentData] = useState({
    student_id: user?.id || '',
    academic_period: '2025-I',
    selected_courses: []
  });
  
  const [validation, setValidation] = useState({
    status: null,
    errors: [],
    warnings: [],
    suggestions: []
  });
  
  const [loading, setLoading] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchAvailableCourses();
  }, []);

  const fetchAvailableCourses = async () => {
    try {
      const response = await fetch(`${API}/courses/available`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      showToast('error', 'Error al cargar cursos disponibles');
    }
  };

  const showToast = (type, message) => {
    const toastElement = document.createElement('div');
    toastElement.setAttribute('data-testid', `toast-${type}`);
    toastElement.textContent = message;
    document.body.appendChild(toastElement);
    
    toast[type](message);
    
    setTimeout(() => {
      document.body.removeChild(toastElement);
    }, 5000);
  };

  const validateEnrollment = async () => {
    if (selectedCourses.length === 0) {
      showToast('error', 'Seleccione al menos un curso para validar');
      return;
    }

    setIsValidating(true);
    setValidation({ status: null, errors: [], warnings: [], suggestions: [] });

    try {
      const payload = {
        student_id: enrollmentData.student_id,
        academic_period: enrollmentData.academic_period,
        course_ids: selectedCourses.map(c => c.id)
      };

      const response = await fetch(`${API}/enrollments/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.status === 409) {
        // Validation failed with conflicts
        setValidation({
          status: 'conflict',
          errors: result.errors || [],
          warnings: result.warnings || [],
          suggestions: result.suggestions || []
        });
        
        if (result.schedule_conflicts) {
          setScheduleConflicts(result.schedule_conflicts);
        }
        
        showToast('error', 'Conflictos detectados en la matrícula');
        
      } else if (response.ok) {
        // Validation passed
        setValidation({
          status: 'success',
          errors: [],
          warnings: result.warnings || [],
          suggestions: []
        });
        
        showToast('success', 'Validación exitosa. Puede proceder con la matrícula.');
        
      } else {
        throw new Error(result.detail || 'Error en validación');
      }

    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        status: 'error',
        errors: [error.message],
        warnings: [],
        suggestions: []
      });
      showToast('error', 'Error en la validación de matrícula');
    } finally {
      setIsValidating(false);
    }
  };

  const showAlternativeSuggestions = () => {
    setShowSuggestions(true);
  };

  const commitEnrollment = async () => {
    if (validation.status !== 'success') {
      showToast('error', 'Debe validar la matrícula antes de confirmarla');
      return;
    }

    setLoading(true);

    try {
      // Generate idempotency key
      const idempotencyKey = `enrollment-${user.id}-${Date.now()}`;
      
      const payload = {
        student_id: enrollmentData.student_id,
        academic_period: enrollmentData.academic_period,
        course_ids: selectedCourses.map(c => c.id)
      };

      const response = await fetch(`${API}/enrollments/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        showToast('success', 'Matrícula realizada exitosamente');
        
        // Reset form
        setSelectedCourses([]);
        setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
        setScheduleConflicts([]);
        
        // Optionally generate enrollment certificate
        if (result.enrollment_id) {
          await generateEnrollmentCertificate(result.enrollment_id);
        }
        
      } else {
        throw new Error(result.detail || 'Error al confirmar matrícula');
      }

    } catch (error) {
      console.error('Enrollment commit error:', error);
      showToast('error', error.message || 'Error al confirmar la matrícula');
    } finally {
      setLoading(false);
    }
  };

  const generateEnrollmentCertificate = async (enrollmentId) => {
    try {
      const result = await generatePDFWithPolling(
        `/enrollments/${enrollmentId}/certificate`,
        {},
        { testId: 'enrollment-certificate' }
      );

      if (result.success) {
        await downloadFile(result.downloadUrl, `matricula-${enrollmentId}.pdf`);
        showToast('success', 'Constancia de matrícula generada');
      }
    } catch (error) {
      console.error('Certificate generation error:', error);
      showToast('error', 'Error al generar constancia de matrícula');
    }
  };

  const generateSchedulePDF = async () => {
    if (selectedCourses.length === 0) {
      showToast('error', 'Seleccione cursos para generar horario');
      return;
    }

    try {
      const result = await generatePDFWithPolling(
        '/schedules/export',
        {
          student_id: enrollmentData.student_id,
          academic_period: enrollmentData.academic_period,
          course_ids: selectedCourses.map(c => c.id)
        },
        { testId: 'schedule-pdf' }
      );

      if (result.success) {
        await downloadFile(result.downloadUrl, `horario-${enrollmentData.academic_period}.pdf`);
        showToast('success', 'Horario exportado exitosamente');
      }
    } catch (error) {
      console.error('Schedule export error:', error);
      showToast('error', 'Error al exportar horario');
    }
  };

  const addCourseToSelection = (course) => {
    if (!selectedCourses.find(c => c.id === course.id)) {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  const removeCourseFromSelection = (courseId) => {
    setSelectedCourses(selectedCourses.filter(c => c.id !== courseId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Matrícula de Cursos</h2>
        <div className="flex space-x-2">
          <Button 
            data-testid="schedule-export-pdf"
            variant="outline" 
            onClick={generateSchedulePDF}
            disabled={selectedCourses.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Exportar Horario
          </Button>
        </div>
      </div>

      {/* Course Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selección de Cursos</CardTitle>
          <CardDescription>
            Seleccione los cursos para el período académico {enrollmentData.academic_period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
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
                    variant={selectedCourses.find(c => c.id === course.id) ? "default" : "outline"}
                    onClick={() => {
                      if (selectedCourses.find(c => c.id === course.id)) {
                        removeCourseFromSelection(course.id);
                      } else {
                        addCourseToSelection(course);
                      }
                    }}
                    className="w-full"
                  >
                    {selectedCourses.find(c => c.id === course.id) ? 'Seleccionado' : 'Seleccionar'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Courses */}
      {selectedCourses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cursos Seleccionados ({selectedCourses.length})</CardTitle>
          </CardHeader>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCourseFromSelection(course.id)}
                    >
                      ×
                    </Button>
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
              {validation.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {validation.status === 'conflict' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              {validation.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-500" />}
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
                
                <Button
                  data-testid="enroll-suggest-alt"
                  variant="outline"
                  onClick={showAlternativeSuggestions}
                  className="mt-3"
                >
                  Ver Sugerencias Alternativas
                </Button>
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
          {isValidating ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Validar Matrícula
            </>
          )}
        </Button>

        <Button
          data-testid="enroll-commit"
          onClick={commitEnrollment}
          disabled={loading || validation.status !== 'success'}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Matrícula
            </>
          )}
        </Button>
      </div>

      {/* Status indicators for E2E testing */}
      <div style={{ display: 'none' }}>
        <div data-testid="enrollment-certificate-status">IDLE</div>
        <div data-testid="schedule-pdf-status">IDLE</div>
      </div>
    </div>
  );
};

export default EnrollmentComponent;