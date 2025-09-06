import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { 
  GraduationCap,
  Users,
  Plus,
  Search,
  Eye,
  Edit,
  Calendar,
  Award,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  BookOpen,
  MapPin,
  Phone,
  Mail,
  User,
  FileCheck,
  BarChart3,
  Save
} from 'lucide-react';
import { useAuth } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Admission Dashboard Component
export const AdmissionDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmissionStats();
  }, []);

  const fetchAdmissionStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/admission-stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching admission stats:', error);
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
        <h2 className="text-2xl font-bold text-gray-900">Dashboard de Admisión</h2>
        <Badge variant="outline" className="text-sm">
          {user?.role === 'ADMIN' && 'Administrador'}
          {user?.role === 'ACADEMIC_STAFF' && 'Personal Académico'}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Postulantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total_applicants || 0}</div>
            <p className="text-xs text-muted-foreground">Registrados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Postulaciones</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.total_applications || 0}</div>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluados</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.total_evaluated || 0}</div>
            <p className="text-xs text-muted-foreground">Con puntaje</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admitidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.total_admitted || 0}</div>
            <p className="text-xs text-muted-foreground">Ingresantes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.status_distribution?.map((item) => (
                <div key={item._id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {item._id === 'REGISTERED' && 'Registrado'}
                    {item._id === 'DOCUMENTS_PENDING' && 'Docs. Pendientes'}
                    {item._id === 'DOCUMENTS_COMPLETE' && 'Docs. Completos'}
                    {item._id === 'EVALUATED' && 'Evaluado'}
                    {item._id === 'ADMITTED' && 'Admitido'}
                    {item._id === 'NOT_ADMITTED' && 'No Admitido'}
                    {item._id === 'WAITING_LIST' && 'Lista de Espera'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{width: `${(item.count / stats.total_applications) * 100}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Career Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Carreras Más Solicitadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.career_distribution?.slice(0, 6).map((item) => (
                <div key={item._id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item._id}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{width: `${(item.count / stats.total_applications) * 100}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Género</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.gender_distribution?.map((item) => (
                <div key={item._id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {item._id === 'M' ? 'Masculino' : 'Femenino'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${item._id === 'M' ? 'bg-blue-600' : 'bg-pink-600'}`}
                        style={{width: `${(item.count / stats.total_applications) * 100}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Puntajes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.score_distribution?.map((item) => (
                <div key={item._id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item._id} puntos</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{width: `${(item.count / stats.total_evaluated) * 100}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución Geográfica (Top 10 Departamentos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.geography_distribution?.slice(0, 10).map((item) => (
              <div key={item._id} className="text-center p-3 border rounded-lg">
                <div className="text-lg font-bold text-blue-600">{item.count}</div>
                <div className="text-xs text-gray-600">{item._id}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Admission Calls Management Component
export const AdmissionCallsManagement = () => {
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
    required_documents: ['BIRTH_CERTIFICATE', 'STUDY_CERTIFICATE', 'PHOTO', 'DNI_COPY']
  });

  useEffect(() => {
    fetchAdmissionCalls();
    fetchCareers();
  }, []);

  const fetchAdmissionCalls = async () => {
    try {
      const response = await axios.get(`${API}/admission-calls`);
      setAdmissionCalls(response.data.admission_calls);
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
      setCareers(response.data.careers);
    } catch (error) {
      console.error('Error fetching careers:', error);
    }
  };

  const handleCreateAdmissionCall = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admission-calls`, formData);
      toast.success('Convocatoria creada exitosamente');
      setIsCreateModalOpen(false);
      fetchAdmissionCalls();
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
        required_documents: ['BIRTH_CERTIFICATE', 'STUDY_CERTIFICATE', 'PHOTO', 'DNI_COPY']
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear convocatoria');
    }
  };

  const handleCareerSelection = (careerId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        available_careers: [...formData.available_careers, careerId],
        career_vacancies: {
          ...formData.career_vacancies,
          [careerId]: 30 // Default 30 vacancies
        }
      });
    } else {
      const newCareers = formData.available_careers.filter(id => id !== careerId);
      const newVacancies = { ...formData.career_vacancies };
      delete newVacancies[careerId];
      setFormData({
        ...formData,
        available_careers: newCareers,
        career_vacancies: newVacancies
      });
    }
  };

  const handleVacancyChange = (careerId, vacancies) => {
    setFormData({
      ...formData,
      career_vacancies: {
        ...formData.career_vacancies,
        [careerId]: parseInt(vacancies) || 0
      }
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
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Convocatorias</h2>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Convocatoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Convocatoria de Admisión</DialogTitle>
              <DialogDescription>
                Configure los parámetros para el proceso de admisión
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAdmissionCall} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre de la Convocatoria *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="academic_year">Año Académico *</Label>
                  <Input
                    id="academic_year"
                    type="number"
                    min="2024"
                    max="2030"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({...formData, academic_year: parseInt(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="academic_period">Período Académico *</Label>
                  <Select value={formData.academic_period} onValueChange={(value) => setFormData({...formData, academic_period: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I">I</SelectItem>
                      <SelectItem value="II">II</SelectItem>
                      <SelectItem value="III">III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="application_fee">Costo de Postulación (S/.)</Label>
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
                  <Label htmlFor="max_applications_per_career">Máximo Carreras por Postulante</Label>
                  <Input
                    id="max_applications_per_career"
                    type="number"
                    min="1"
                    max="3"
                    value={formData.max_applications_per_career}
                    onChange={(e) => setFormData({...formData, max_applications_per_career: parseInt(e.target.value)})}
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-4">
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

              <div>
                <Label>Carreras Disponibles y Vacantes</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {careers.map((career) => (
                    <div key={career.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`career_${career.id}`}
                          checked={formData.available_careers.includes(career.id)}
                          onChange={(e) => handleCareerSelection(career.id, e.target.checked)}
                        />
                        <Label htmlFor={`career_${career.id}`} className="text-sm">
                          {career.name}
                        </Label>
                      </div>
                      {formData.available_careers.includes(career.id) && (
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.career_vacancies[career.id] || 30}
                          onChange={(e) => handleVacancyChange(career.id, e.target.value)}
                          className="w-20"
                          placeholder="Vacantes"
                        />
                      )}
                    </div>
                  ))}
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
        {admissionCalls.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No hay convocatorias</h3>
            <p className="text-gray-500 mb-4">
              Aún no se han creado convocatorias de admisión.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Convocatoria
            </Button>
          </div>
        ) : (
          admissionCalls.map((call) => (
            <Card key={call.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{call.name}</CardTitle>
                    <CardDescription>
                      Año Académico {call.academic_year} - Período {call.academic_period}
                    </CardDescription>
                  </div>
                  <Badge variant={call.status === 'OPEN' ? 'default' : 'secondary'}>
                    {call.status === 'OPEN' ? 'Abierta' : call.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Cronograma</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Inscripciones:</span>
                        <span>{new Date(call.registration_start).toLocaleDateString()} - {new Date(call.registration_end).toLocaleDateString()}</span>
                      </div>
                      {call.exam_date && (
                        <div className="flex justify-between">
                          <span>Examen:</span>
                          <span>{new Date(call.exam_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {call.results_date && (
                        <div className="flex justify-between">
                          <span>Resultados:</span>
                          <span>{new Date(call.results_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Estadísticas</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Postulaciones:</span>
                        <span className="font-medium">{call.total_applications || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Carreras:</span>
                        <span className="font-medium">{call.careers?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costo:</span>
                        <span className="font-medium">S/. {call.application_fee}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Carreras ({call.careers?.length || 0})</h4>
                  <div className="flex flex-wrap gap-2">
                    {call.careers?.slice(0, 3).map((career) => (
                      <Badge key={career.id} variant="outline">
                        {career.name} ({career.vacancies} vacantes)
                      </Badge>
                    ))}
                    {call.careers?.length > 3 && (
                      <Badge variant="outline">
                        +{call.careers.length - 3} más
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
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
                    Publicar Resultados
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};