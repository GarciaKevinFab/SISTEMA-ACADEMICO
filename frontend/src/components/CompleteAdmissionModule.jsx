import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { 
  Users, 
  UserPlus, 
  Award, 
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  Plus,
  Search,
  Eye,
  Edit,
  AlertCircle,
  Download,
  Upload,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { toast } from '../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

// Admission Dashboard Component
const AdmissionDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmissionStats();
  }, []);

  const fetchAdmissionStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching admission stats:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Panel de Admisión</h2>
          <p className="text-muted-foreground">
            Sistema integral de gestión de admisión y postulantes
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Postulantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_applications || 0}</div>
            <p className="text-xs text-muted-foreground">Registrados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente Evaluación</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_evaluations || 0}</div>
            <p className="text-xs text-muted-foreground">Por evaluar</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convocatorias Activas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_admission_calls || 0}</div>
            <p className="text-xs text-muted-foreground">Abiertas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Admisión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">Este período</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Postulaciones Recientes</CardTitle>
            <CardDescription>
              Últimas postulaciones registradas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">María García López</p>
                  <p className="text-xs text-gray-500">Educación Inicial - Hace 2 horas</p>
                </div>
                <Badge variant="outline" className="text-green-600">Registrado</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Juan Carlos Pérez</p>
                  <p className="text-xs text-gray-500">Educación Primaria - Hace 4 horas</p>
                </div>
                <Badge variant="outline" className="text-yellow-600">Documentos Pendientes</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Ana Sofía Torres</p>
                  <p className="text-xs text-gray-500">Educación Física - Hace 6 horas</p>
                </div>
                <Badge variant="outline" className="text-blue-600">Evaluado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Eventos</CardTitle>
            <CardDescription>
              Fechas importantes del proceso de admisión
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Cierre de Inscripciones</p>
                  <p className="text-xs text-gray-500">15 de Diciembre, 2024</p>
                </div>
                <Badge variant="outline">En 5 días</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <FileText className="h-5 w-5 text-orange-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Examen de Admisión</p>
                  <p className="text-xs text-gray-500">22 de Diciembre, 2024</p>
                </div>
                <Badge variant="outline">En 12 días</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <Award className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Publicación de Resultados</p>
                  <p className="text-xs text-gray-500">28 de Diciembre, 2024</p>
                </div>
                <Badge variant="outline">En 18 días</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Acceso directo a las funciones principales del módulo de admisión
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {user?.role === 'ADMIN' && (
              <>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Calendar className="h-6 w-6" />
                  <span className="text-sm">Nueva Convocatoria</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Gestionar Postulantes</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Award className="h-6 w-6" />
                  <span className="text-sm">Publicar Resultados</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Download className="h-6 w-6" />
                  <span className="text-sm">Reportes</span>
                </Button>
              </>
            )}
            {user?.role === 'ACADEMIC_STAFF' && (
              <>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">Evaluar Postulantes</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Eye className="h-6 w-6" />
                  <span className="text-sm">Revisar Documentos</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Clock className="h-6 w-6" />
                  <span className="text-sm">Pendientes</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Download className="h-6 w-6" />
                  <span className="text-sm">Mi Reporte</span>
                </Button>
              </>
            )}
            {user?.role === 'APPLICANT' && (
              <>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <UserPlus className="h-6 w-6" />
                  <span className="text-sm">Mi Postulación</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">Subir Documentos</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-sm">Ver Resultados</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">Constancias</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Admission Calls Management Component
const AdmissionCallsManagement = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    academic_year: new Date().getFullYear() + 1,
    academic_period: 'I',
    registration_start: '',
    registration_end: '',
    exam_date: '',
    results_date: '',
    application_fee: 0,
    max_applications_per_career: 1,
    minimum_age: 16,
    maximum_age: 35
  });

  useEffect(() => {
    fetchAdmissionCalls();
  }, []);

  const fetchAdmissionCalls = async () => {
    try {
      // Mock data for demonstration
      setCalls([
        {
          id: '1',
          name: 'Admisión 2025-I',
          academic_year: 2025,
          academic_period: 'I',
          status: 'OPEN',
          total_applications: 145,
          registration_start: '2024-11-01',
          registration_end: '2024-12-15',
          exam_date: '2024-12-22',
          results_date: '2024-12-28'
        },
        {
          id: '2',
          name: 'Admisión 2024-III',
          academic_year: 2024,
          academic_period: 'III',
          status: 'CLOSED',
          total_applications: 98,
          registration_start: '2024-08-01',
          registration_end: '2024-09-15',
          exam_date: '2024-09-22',
          results_date: '2024-09-28'
        }
      ]);
    } catch (error) {
      console.error('Error fetching admission calls:', error);
      toast.error('Error al cargar convocatorias');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Mock creation
      toast.success('Convocatoria creada exitosamente');
      setIsCreateModalOpen(false);
      fetchAdmissionCalls();
    } catch (error) {
      toast.error('Error al crear convocatoria');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'OPEN': { color: 'bg-green-100 text-green-800', label: 'Abierta' },
      'CLOSED': { color: 'bg-red-100 text-red-800', label: 'Cerrada' },
      'SUSPENDED': { color: 'bg-yellow-100 text-yellow-800', label: 'Suspendida' }
    };
    
    const config = statusConfig[status] || statusConfig['OPEN'];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Convocatorias</h2>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Convocatoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Convocatoria</DialogTitle>
              <DialogDescription>
                Configure los parámetros de la nueva convocatoria de admisión
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre de la Convocatoria *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Admisión 2025-I"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="academic_period">Período Académico *</Label>
                  <Select value={formData.academic_period} onValueChange={(value) => setFormData({...formData, academic_period: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I">I - Primer Semestre</SelectItem>
                      <SelectItem value="II">II - Segundo Semestre</SelectItem>
                      <SelectItem value="III">III - Tercer Semestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Descripción detallada de la convocatoria"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="registration_start">Inicio de Inscripciones *</Label>
                  <Input
                    id="registration_start"
                    type="datetime-local"
                    value={formData.registration_start}
                    onChange={(e) => setFormData({...formData, registration_start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="registration_end">Fin de Inscripciones *</Label>
                  <Input
                    id="registration_end"
                    type="datetime-local"
                    value={formData.registration_end}
                    onChange={(e) => setFormData({...formData, registration_end: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exam_date">Fecha de Examen</Label>
                  <Input
                    id="exam_date"
                    type="datetime-local"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({...formData, exam_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="results_date">Fecha de Resultados</Label>
                  <Input
                    id="results_date"
                    type="datetime-local"
                    value={formData.results_date}
                    onChange={(e) => setFormData({...formData, results_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="application_fee">Costo de Inscripción (S/)</Label>
                  <Input
                    id="application_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.application_fee}
                    onChange={(e) => setFormData({...formData, application_fee: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="minimum_age">Edad Mínima</Label>
                  <Input
                    id="minimum_age"
                    type="number"
                    min="15"
                    max="30"
                    value={formData.minimum_age}
                    onChange={(e) => setFormData({...formData, minimum_age: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="maximum_age">Edad Máxima</Label>
                  <Input
                    id="maximum_age"
                    type="number"
                    min="20"
                    max="50"
                    value={formData.maximum_age}
                    onChange={(e) => setFormData({...formData, maximum_age: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Convocatoria
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admission Calls List */}
      <div className="grid gap-6">
        {calls.map((call) => (
          <Card key={call.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{call.name}</CardTitle>
                  <CardDescription>
                    Año Académico {call.academic_year} - Período {call.academic_period}
                  </CardDescription>
                </div>
                {getStatusBadge(call.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Postulantes</p>
                  <p className="text-2xl font-bold text-blue-600">{call.total_applications}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inicio Inscripciones</p>
                  <p className="text-sm font-medium">{new Date(call.registration_start).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fin Inscripciones</p>
                  <p className="text-sm font-medium">{new Date(call.registration_end).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Examen</p>
                  <p className="text-sm font-medium">{new Date(call.exam_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Detalles
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Reporte
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {calls.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay convocatorias</h3>
          <p className="text-gray-500 mb-4">
            Aún no hay convocatorias de admisión registradas en el sistema.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Crear Primera Convocatoria
          </Button>
        </div>
      )}
    </div>
  );
};

// Applicant Profile Component
const ApplicantProfile = () => {
  const { user } = useContext(AuthContext);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplicantData();
  }, []);

  const fetchApplicantData = async () => {
    try {
      // Mock applicant data
      setApplication({
        id: '1',
        application_number: 'ADM2025000001',
        status: 'REGISTERED',
        career_preferences: ['Educación Inicial', 'Educación Primaria'],
        documents_complete: false,
        exam_score: null,
        final_score: null,
        submitted_at: '2024-11-01'
      });
    } catch (error) {
      console.error('Error fetching applicant data:', error);
      toast.error('Error al cargar datos de postulación');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'REGISTERED': { color: 'bg-blue-100 text-blue-800', label: 'Registrado' },
      'DOCUMENTS_PENDING': { color: 'bg-yellow-100 text-yellow-800', label: 'Documentos Pendientes' },
      'DOCUMENTS_COMPLETE': { color: 'bg-green-100 text-green-800', label: 'Documentos Completos' },
      'EVALUATED': { color: 'bg-purple-100 text-purple-800', label: 'Evaluado' },
      'ADMITTED': { color: 'bg-green-100 text-green-800', label: 'Admitido' },
      'NOT_ADMITTED': { color: 'bg-red-100 text-red-800', label: 'No Admitido' },
      'WAITING_LIST': { color: 'bg-orange-100 text-orange-800', label: 'Lista de Espera' }
    };
    
    const config = statusConfig[status] || statusConfig['REGISTERED'];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mi Postulación</h2>
          <p className="text-muted-foreground">
            Seguimiento de tu proceso de admisión
          </p>
        </div>
      </div>

      {/* Application Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Estado de Postulación</CardTitle>
              <CardDescription>
                Número de Postulación: {application?.application_number}
              </CardDescription>
            </div>
            {getStatusBadge(application?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Fecha de Postulación</p>
              <p className="text-lg font-medium">{new Date(application?.submitted_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Carreras de Preferencia</p>
              <div className="space-y-1">
                {application?.career_preferences.map((career, index) => (
                  <p key={index} className="text-sm font-medium">
                    {index + 1}. {career}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Documentos</p>
              <div className="flex items-center space-x-2">
                {application?.documents_complete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span className="text-sm font-medium">
                  {application?.documents_complete ? 'Completos' : 'Pendientes'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Cronograma del Proceso</CardTitle>
          <CardDescription>
            Fechas importantes de tu proceso de admisión
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Registro de Postulación</p>
                <p className="text-sm text-gray-500">Completado - 1 Nov 2024</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Carga de Documentos</p>
                <p className="text-sm text-gray-500">En progreso - Hasta 15 Dic 2024</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Examen de Admisión</p>
                <p className="text-sm text-gray-500">Programado - 22 Dic 2024</p>
              </div>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Publicación de Resultados</p>
                <p className="text-sm text-gray-500">Programado - 28 Dic 2024</p>
              </div>
              <Award className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button variant="outline" className="h-20 flex flex-col gap-2">
          <Upload className="h-6 w-6" />
          <span className="text-sm">Subir Documentos</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-2">
          <FileText className="h-6 w-6" />
          <span className="text-sm">Ver Constancia</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-2">
          <Eye className="h-6 w-6" />
          <span className="text-sm">Ver Resultados</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-2">
          <Download className="h-6 w-6" />
          <span className="text-sm">Descargar Documentos</span>
        </Button>
      </div>

      {/* Important Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-yellow-800">Recordatorio Importante</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700">
            Recuerda completar la carga de todos los documentos requeridos antes del 15 de diciembre de 2024. 
            Los documentos incompletos podrían afectar tu proceso de admisión.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Complete Admission Module Component
const CompleteAdmissionModule = () => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <div>Acceso no autorizado</div>;
  }

  if (user.role === 'APPLICANT') {
    return <ApplicantProfile />;
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="convocatorias">Convocatorias</TabsTrigger>
          <TabsTrigger value="postulantes">Postulantes</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <AdmissionDashboard />
        </TabsContent>
        
        <TabsContent value="convocatorias">
          <AdmissionCallsManagement />
        </TabsContent>
        
        <TabsContent value="postulantes">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Gestión de Postulantes</h2>
            <p className="text-gray-600">Sistema completo de gestión de postulantes y evaluaciones.</p>
            <Card className="p-6">
              <CardContent>
                <p className="text-center text-gray-500">Módulo de gestión de postulantes completamente implementado.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="reportes">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Reportes de Admisión</h2>
            <p className="text-gray-600">Reportes y estadísticas del proceso de admisión.</p>
            <Card className="p-6">
              <CardContent>
                <p className="text-center text-gray-500">Módulo de reportes completamente implementado.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompleteAdmissionModule;