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
  FileCheck
} from 'lucide-react';
import { useAuth } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Public Admission Calls Component (No auth required)
export const PublicAdmissionCalls = () => {
  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicAdmissionCalls();
  }, []);

  const fetchPublicAdmissionCalls = async () => {
    try {
      const response = await axios.get(`${API}/public/admission-calls`);
      setAdmissionCalls(response.data.admission_calls);
    } catch (error) {
      console.error('Error fetching admission calls:', error);
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
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Convocatorias de Admisión</h2>
        <p className="text-lg text-gray-600">
          IESPP "Gustavo Allende Llavería" - Proceso de Admisión 2025
        </p>
      </div>

      {admissionCalls.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No hay convocatorias abiertas</h3>
          <p className="text-gray-500">
            Por el momento no hay procesos de admisión abiertos. Mantente atento a nuestros anuncios.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {admissionCalls.map((call) => (
            <Card key={call.id} className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-t-lg">
                <CardTitle className="text-2xl">{call.name}</CardTitle>
                <CardDescription className="text-blue-100">
                  {call.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Información General</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span><strong>Período Académico:</strong> {call.academic_year} - {call.academic_period}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span><strong>Inscripciones:</strong> {new Date(call.registration_start).toLocaleDateString()} - {new Date(call.registration_end).toLocaleDateString()}</span>
                      </div>
                      {call.exam_date && (
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-gray-500" />
                          <span><strong>Examen:</strong> {new Date(call.exam_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {call.results_date && (
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-gray-500" />
                          <span><strong>Resultados:</strong> {new Date(call.results_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Requisitos</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Edad:</strong> {call.minimum_age} - {call.maximum_age} años</div>
                      <div><strong>Costo:</strong> S/. {call.application_fee}</div>
                      <div>
                        <strong>Documentos requeridos:</strong>
                        <ul className="list-disc list-inside mt-1 text-xs text-gray-600">
                          {call.required_documents?.map((doc, index) => (
                            <li key={index}>
                              {doc === 'BIRTH_CERTIFICATE' && 'Partida de nacimiento'}
                              {doc === 'STUDY_CERTIFICATE' && 'Certificado de estudios'}
                              {doc === 'PHOTO' && 'Fotografía'}
                              {doc === 'DNI_COPY' && 'Copia de DNI'}
                              {doc === 'CONADIS_COPY' && 'Copia carné CONADIS'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Carreras Disponibles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {call.careers?.map((career) => (
                      <div key={career.id} className="border rounded-lg p-3">
                        <h5 className="font-medium text-gray-900">{career.name}</h5>
                        <p className="text-xs text-gray-600 mb-2">{career.description}</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Duración: {career.duration_years} años</span>
                          <Badge variant="outline">
                            {career.vacancies} vacantes
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex gap-4">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <User className="h-4 w-4 mr-2" />
                    Postular Ahora
                  </Button>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Prospecto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Applicant Profile Component
export const ApplicantProfile = () => {
  const { user } = useAuth();
  const [applicant, setApplicant] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    second_last_name: '',
    birth_date: '',
    gender: 'M',
    document_type: 'DNI',
    document_number: '',
    email: '',
    phone: '',
    address: '',
    district: '',
    province: '',
    department: '',
    high_school_name: '',
    high_school_year: new Date().getFullYear() - 1,
    has_disability: false,
    disability_description: '',
    conadis_number: '',
    guardian_name: '',
    guardian_phone: '',
    monthly_family_income: ''
  });

  useEffect(() => {
    if (user?.role === 'APPLICANT') {
      fetchApplicantProfile();
      fetchMyApplications();
    }
  }, [user]);

  const fetchApplicantProfile = async () => {
    try {
      const response = await axios.get(`${API}/applicants/me`);
      setApplicant(response.data);
      setFormData({
        ...response.data,
        birth_date: response.data.birth_date?.split('T')[0] || ''
      });
    } catch (error) {
      if (error.response?.status === 404) {
        // No profile exists yet
        setApplicant(null);
      } else {
        console.error('Error fetching applicant profile:', error);
        toast.error('Error al cargar perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMyApplications = async () => {
    try {
      const response = await axios.get(`${API}/applications/me`);
      setApplications(response.data.applications);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/applicants`, formData);
      setApplicant(response.data.applicant);
      setIsEditModalOpen(false);
      toast.success('Perfil creado exitosamente');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear perfil');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'REGISTERED': { color: 'bg-blue-100 text-blue-800', label: 'Registrado', icon: FileText },
      'DOCUMENTS_PENDING': { color: 'bg-yellow-100 text-yellow-800', label: 'Docs. Pendientes', icon: Clock },
      'DOCUMENTS_COMPLETE': { color: 'bg-green-100 text-green-800', label: 'Docs. Completos', icon: CheckCircle },
      'EVALUATED': { color: 'bg-purple-100 text-purple-800', label: 'Evaluado', icon: Award },
      'ADMITTED': { color: 'bg-green-100 text-green-800', label: 'Admitido', icon: CheckCircle },
      'NOT_ADMITTED': { color: 'bg-red-100 text-red-800', label: 'No Admitido', icon: XCircle },
      'WAITING_LIST': { color: 'bg-orange-100 text-orange-800', label: 'Lista de Espera', icon: Clock }
    };
    
    const config = statusConfig[status] || statusConfig['REGISTERED'];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
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

  if (!applicant) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 mb-4">Complete su Perfil de Postulante</h3>
        <p className="text-gray-500 mb-6">
          Para postular a nuestras convocatorias, primero debe completar su perfil con sus datos personales.
        </p>
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Perfil
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Perfil de Postulante</DialogTitle>
              <DialogDescription>
                Complete sus datos personales para el proceso de admisión
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="first_name">Nombres *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Apellido Paterno *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="second_last_name">Apellido Materno</Label>
                  <Input
                    id="second_last_name"
                    value={formData.second_last_name}
                    onChange={(e) => setFormData({...formData, second_last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="birth_date">Fecha de Nacimiento *</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Género *</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="document_type">Tipo de Documento *</Label>
                  <Select value={formData.document_type} onValueChange={(value) => setFormData({...formData, document_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="FOREIGN_CARD">Carné de Extranjería</SelectItem>
                      <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                      <SelectItem value="CONADIS_CARD">Carné CONADIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="document_number">Número de Documento *</Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({...formData, document_number: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address">Dirección *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="district">Distrito *</Label>
                  <Input
                    id="district"
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="province">Provincia *</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="department">Departamento *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="high_school_name">Colegio de Procedencia *</Label>
                  <Input
                    id="high_school_name"
                    value={formData.high_school_name}
                    onChange={(e) => setFormData({...formData, high_school_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="high_school_year">Año de Egreso *</Label>
                  <Input
                    id="high_school_year"
                    type="number"
                    min="2010"
                    max="2025"
                    value={formData.high_school_year}
                    onChange={(e) => setFormData({...formData, high_school_year: parseInt(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="has_disability"
                    checked={formData.has_disability}
                    onChange={(e) => setFormData({...formData, has_disability: e.target.checked})}
                  />
                  <Label htmlFor="has_disability">¿Tiene alguna discapacidad?</Label>
                </div>
                
                {formData.has_disability && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="disability_description">Descripción de la Discapacidad</Label>
                      <Textarea
                        id="disability_description"
                        value={formData.disability_description}
                        onChange={(e) => setFormData({...formData, disability_description: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="conadis_number">Número de Carné CONADIS</Label>
                      <Input
                        id="conadis_number"
                        value={formData.conadis_number}
                        onChange={(e) => setFormData({...formData, conadis_number: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Perfil
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Mi Perfil de Postulante</h2>
        <Button variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Editar Perfil
        </Button>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Código: {applicant.applicant_code}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Nombre Completo</Label>
              <p className="text-sm font-medium">
                {applicant.first_name} {applicant.last_name} {applicant.second_last_name}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Documento</Label>
              <p className="text-sm">{applicant.document_type}: {applicant.document_number}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Fecha de Nacimiento</Label>
              <p className="text-sm">{new Date(applicant.birth_date).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Email</Label>
              <p className="text-sm">{applicant.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Teléfono</Label>
              <p className="text-sm">{applicant.phone}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Colegio</Label>
              <p className="text-sm">{applicant.high_school_name} ({applicant.high_school_year})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Postulaciones</CardTitle>
          <CardDescription>Historial de postulaciones a convocatorias</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No has realizado ninguna postulación aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <div key={application.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{application.admission_call?.name}</h4>
                    {getStatusBadge(application.status)}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <p>Número de postulación: {application.application_number}</p>
                    <p>Fecha: {new Date(application.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-sm">
                    <strong>Carreras de preferencia:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {application.career_preferences_details?.map((career, index) => (
                        <li key={career.id}>
                          {index + 1}. {career.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {application.final_score && (
                    <div className="mt-2">
                      <strong>Puntaje final:</strong> {application.final_score}/20
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};