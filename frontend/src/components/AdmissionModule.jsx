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
  GraduationCap, 
  Award, 
  Calendar,
  BarChart3,
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  School,
  BookOpen
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
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Mock stats for now - replace with actual API call
      setStats({
        total_applications: 245,
        active_calls: 2,
        pending_evaluations: 67,
        published_results: 1
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
          <h2 className="text-3xl font-bold tracking-tight">Sistema de Admisión</h2>
          <p className="text-muted-foreground">
            Gestión integral del proceso de admisión e inscripción de postulantes
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Postulaciones</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_applications || 0}</div>
            <p className="text-xs text-muted-foreground">Todas las postulaciones</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convocatorias Activas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_calls || 0}</div>
            <p className="text-xs text-muted-foreground">En proceso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluaciones Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_evaluations || 0}</div>
            <p className="text-xs text-muted-foreground">Por evaluar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultados Publicados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published_results || 0}</div>
            <p className="text-xs text-muted-foreground">Convocatorias cerradas</p>
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
            {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
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
                  <span className="text-sm">Evaluaciones</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-sm">Reportes</span>
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
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">Mis Documentos</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-sm">Estado</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Award className="h-6 w-6" />
                  <span className="text-sm">Resultados</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Careers Management Component
const CareersManagement = () => {
  const { user } = useContext(AuthContext);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    duration_years: 5,
    is_active: true
  });

  useEffect(() => {
    fetchCareers();
  }, []);

  const fetchCareers = async () => {
    try {
      const response = await axios.get(`${API}/careers`);
      setCareers(response.data.careers || []);
    } catch (error) {
      console.error('Error fetching careers:', error);
      toast.error('Error al cargar carreras');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/careers`, formData);
      toast.success('Carrera creada exitosamente');
      setIsCreateModalOpen(false);
      resetForm();
      fetchCareers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear carrera');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      duration_years: 5,
      is_active: true
    });
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
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Carreras</h2>
        {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Carrera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Nueva Carrera</DialogTitle>
                <DialogDescription>
                  Configure una nueva carrera profesional en el sistema
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    required
                    placeholder="Ej: EI, EP, EM"
                    maxLength={10}
                  />
                </div>
                
                <div>
                  <Label htmlFor="name">Nombre de la Carrera *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="Ej: Educación Inicial"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descripción de la carrera profesional"
                  />
                </div>

                <div>
                  <Label htmlFor="duration_years">Duración (años) *</Label>
                  <Input
                    id="duration_years"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.duration_years}
                    onChange={(e) => setFormData({...formData, duration_years: parseInt(e.target.value)})}
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Crear Carrera
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Careers List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carrera</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {careers.map((career) => (
                  <tr key={career.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {career.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{career.name}</div>
                        <div className="text-sm text-gray-500">{career.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {career.duration_years} años
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={career.is_active ? 'default' : 'secondary'}>
                        {career.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {careers.length === 0 && (
        <div className="text-center py-12">
          <School className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay carreras registradas</h3>
          <p className="text-gray-500 mb-4">
            Cree la primera carrera profesional para comenzar con el proceso de admisión.
          </p>
          {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Carrera
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Admission Calls Management Component
const AdmissionCallsManagement = () => {
  const { user } = useContext(AuthContext);
  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    academic_year: new Date().getFullYear(),
    academic_period: 'I',
    registration_start: '',
    registration_end: '',
    exam_date: '',
    results_date: '',
    application_fee: 0,
    max_applications_per_career: 1,
    available_careers: [],
    career_vacancies: {},
    minimum_age: 16,
    maximum_age: 35,
    required_documents: ['BIRTH_CERTIFICATE', 'STUDY_CERTIFICATE', 'PHOTO', 'DNI_COPY'],
    is_active: true
  });

  useEffect(() => {
    fetchAdmissionCalls();
    fetchCareers();
  }, []);

  const fetchAdmissionCalls = async () => {
    try {
      const response = await axios.get(`${API}/admission-calls`);
      setAdmissionCalls(response.data.admission_calls || []);
    } catch (error) {
      console.error('Error fetching admission calls:', error);
      toast.error('Error al cargar convocatorias');
    } finally {
      setLoading(false);
    }
  };

  const fetchCareers = async () => {
    try {
      const response = await axios.get(`${API}/careers`);
      setCareers(response.data.careers || []);
    } catch (error) {
      console.error('Error fetching careers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admission-calls`, formData);
      toast.success('Convocatoria creada exitosamente');
      setIsCreateModalOpen(false);
      resetForm();
      fetchAdmissionCalls();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear convocatoria');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      academic_year: new Date().getFullYear(),
      academic_period: 'I',
      registration_start: '',
      registration_end: '',
      exam_date: '',
      results_date: '',
      application_fee: 0,
      max_applications_per_career: 1,
      available_careers: [],
      career_vacancies: {},
      minimum_age: 16,
      maximum_age: 35,
      required_documents: ['BIRTH_CERTIFICATE', 'STUDY_CERTIFICATE', 'PHOTO', 'DNI_COPY'],
      is_active: true
    });
  };

  const getStatusBadge = (call) => {
    const now = new Date();
    const regStart = new Date(call.registration_start);
    const regEnd = new Date(call.registration_end);
    
    if (now < regStart) {
      return <Badge variant="secondary">Próximamente</Badge>;
    } else if (now >= regStart && now <= regEnd) {
      return <Badge variant="default">Inscripciones Abiertas</Badge>;
    } else {
      return <Badge variant="outline">Cerrada</Badge>;
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
        <h2 className="text-2xl font-bold text-gray-900">Convocatorias de Admisión</h2>
        {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
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
                  Configure los detalles de la nueva convocatoria de admisión
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
                      required
                      placeholder="Ej: Admisión 2024-I"
                    />
                  </div>
                  <div>
                    <Label htmlFor="academic_period">Período Académico *</Label>
                    <Select value={formData.academic_period} onValueChange={(value) => setFormData({...formData, academic_period: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">I Semestre</SelectItem>
                        <SelectItem value="II">II Semestre</SelectItem>
                        <SelectItem value="III">III Semestre</SelectItem>
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
                    placeholder="Descripción de la convocatoria"
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
        )}
      </div>

      {/* Admission Calls List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Convocatoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inscripciones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Postulaciones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admissionCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{call.name}</div>
                        <div className="text-sm text-gray-500">{call.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {call.academic_year}-{call.academic_period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div>Inicio: {new Date(call.registration_start).toLocaleDateString()}</div>
                        <div>Fin: {new Date(call.registration_end).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(call)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {call.total_applications || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
                          <>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {admissionCalls.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay convocatorias registradas</h3>
          <p className="text-gray-500 mb-4">
            Cree la primera convocatoria de admisión para comenzar el proceso.
          </p>
          {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Convocatoria
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Public Admission Results Component
const PublicAdmissionResults = () => {
  const [admissionCallId, setAdmissionCallId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [publicCalls, setPublicCalls] = useState([]);

  useEffect(() => {
    fetchPublicCalls();
  }, []);

  const fetchPublicCalls = async () => {
    try {
      const response = await axios.get(`${API}/public/admission-calls`);
      setPublicCalls(response.data.admission_calls || []);
    } catch (error) {
      console.error('Error fetching public calls:', error);
    }
  };

  const handleResultCheck = async (e) => {
    e.preventDefault();
    if (!admissionCallId || !documentNumber.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.get(`${API}/admission-results/public/${admissionCallId}/${documentNumber}`);
      setResult(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setError('Resultados no encontrados. Verifique los datos ingresados o si los resultados han sido publicados.');
      } else {
        setError('Error al consultar resultados. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Consulta de Resultados de Admisión</h2>
        <p className="text-gray-600">Consulte sus resultados de admisión ingresando los datos solicitados</p>
      </div>

      {/* Results Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleResultCheck} className="space-y-4">
            <div>
              <Label htmlFor="admission-call">Convocatoria</Label>
              <Select value={admissionCallId} onValueChange={setAdmissionCallId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione la convocatoria" />
                </SelectTrigger>
                <SelectContent>
                  {publicCalls.map(call => (
                    <SelectItem key={call.id} value={call.id}>
                      {call.name} - {call.academic_year}-{call.academic_period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="document-number">Número de Documento</Label>
              <div className="flex gap-2">
                <Input
                  id="document-number"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingrese su DNI"
                  className="flex-1"
                />
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Consultar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Resultado de Admisión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Postulante</Label>
                <div className="font-medium">{result.applicant_name}</div>
              </div>
              <div>
                <Label>Documento</Label>
                <div>{result.document_number}</div>
              </div>
              <div>
                <Label>Carrera</Label>
                <div>{result.career}</div>
              </div>
              <div>
                <Label>Resultado</Label>
                <div className="mt-1">
                  {result.is_admitted ? (
                    <Badge variant="success" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      ADMITIDO(A)
                    </Badge>
                  ) : (
                    result.result_type === 'WAITING_LIST' ? (
                      <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 mr-1" />
                        LISTA DE ESPERA
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-4 w-4 mr-1" />
                        NO ADMITIDO(A)
                      </Badge>
                    )
                  )}
                </div>
              </div>
              <div>
                <Label>Posición</Label>
                <div className="font-bold text-lg">{result.position}</div>
              </div>
              <div>
                <Label>Puntaje Final</Label>
                <div className="font-bold text-lg">{result.final_score.toFixed(2)}</div>
              </div>
            </div>

            {result.is_admitted && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">¡Felicitaciones!</h4>
                <p className="text-green-700">
                  Ha sido admitido(a) en la carrera de <strong>{result.career}</strong>. 
                  Pronto recibirá información sobre el proceso de matrícula.
                </p>
              </div>
            )}

            {result.result_type === 'WAITING_LIST' && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Lista de Espera</h4>
                <p className="text-yellow-700">
                  Se encuentra en la lista de espera para la carrera de <strong>{result.career}</strong>. 
                  Será contactado si se libera una vacante.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Main Admission Module Component
const AdmissionModule = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="p-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="careers">Carreras</TabsTrigger>
          <TabsTrigger value="calls">Convocatorias</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <AdmissionDashboard />
        </TabsContent>
        
        <TabsContent value="careers">
          <CareersManagement />
        </TabsContent>
        
        <TabsContent value="calls">
          <AdmissionCallsManagement />
        </TabsContent>
        
        <TabsContent value="results">
          <PublicAdmissionResults />
        </TabsContent>
        
        <TabsContent value="reports">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Reportes de Admisión</h2>
            <p className="text-gray-600">Sistema de reportes y estadísticas del proceso de admisión.</p>
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

export default AdmissionModule;