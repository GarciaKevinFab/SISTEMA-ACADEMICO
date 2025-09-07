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
  FileText, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Upload,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';
import axios from 'axios';
import { toast } from '../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

// Mesa de Partes Dashboard Component
const MesaPartesDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/mesa-partes/dashboard/stats`);
      setStats(response.data.stats);
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
          <h2 className="text-3xl font-bold tracking-tight">Mesa de Partes Virtual</h2>
          <p className="text-muted-foreground">
            Sistema digital de gestión de trámites y procedimientos
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {user?.role === 'ADMIN' || user?.role === 'ADMIN_WORKER' ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Trámites</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_procedures || 0}</div>
                <p className="text-xs text-muted-foreground">Todos los trámites</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending_procedures || 0}</div>
                <p className="text-xs text-muted-foreground">Por atender</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.in_process_procedures || 0}</div>
                <p className="text-xs text-muted-foreground">En revisión</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.overdue_procedures || 0}</div>
                <p className="text-xs text-muted-foreground">Fuera de plazo</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mis Trámites</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.my_procedures || 0}</div>
                <p className="text-xs text-muted-foreground">Total presentados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.my_pending || 0}</div>
                <p className="text-xs text-muted-foreground">En proceso</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Acceso directo a las funciones principales del módulo de trámites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Plus className="h-6 w-6" />
              <span className="text-sm">Nuevo Trámite</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Search className="h-6 w-6" />
              <span className="text-sm">Seguimiento</span>
            </Button>
            
            {(user?.role === 'ADMIN' || user?.role === 'ADMIN_WORKER') && (
              <>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Gestionar Trámites</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-sm">Reportes</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Procedure Types Management Component
const ProcedureTypesManagement = () => {
  const { user } = useContext(AuthContext);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    area: 'ACADEMIC',
    required_documents: [],
    processing_days: 5,
    is_active: true
  });

  useEffect(() => {
    fetchProcedureTypes();
  }, []);

  const fetchProcedureTypes = async () => {
    try {
      const response = await axios.get(`${API}/mesa-partes/procedure-types`);
      setProcedureTypes(response.data.procedure_types);
    } catch (error) {
      console.error('Error fetching procedure types:', error);
      toast.error('Error al cargar tipos de trámite');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/mesa-partes/procedure-types`, formData);
      toast.success('Tipo de trámite creado exitosamente');
      setIsCreateModalOpen(false);
      resetForm();
      fetchProcedureTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear tipo de trámite');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      area: 'ACADEMIC',
      required_documents: [],
      processing_days: 5,
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
        <h2 className="text-2xl font-bold text-gray-900">Tipos de Trámite</h2>
        {user?.role === 'ADMIN' && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Tipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Tipo de Trámite</DialogTitle>
                <DialogDescription>
                  Configure un nuevo tipo de trámite para el sistema
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Trámite *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="Ej: Constancia de Estudios"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descripción del trámite"
                  />
                </div>

                <div>
                  <Label htmlFor="area">Área Responsable *</Label>
                  <Select value={formData.area} onValueChange={(value) => setFormData({...formData, area: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACADEMIC">Académica</SelectItem>
                      <SelectItem value="ADMINISTRATIVE">Administrativa</SelectItem>
                      <SelectItem value="FINANCIAL">Financiera</SelectItem>
                      <SelectItem value="HR">Recursos Humanos</SelectItem>
                      <SelectItem value="GENERAL">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="processing_days">Días de Procesamiento *</Label>
                  <Input
                    id="processing_days"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.processing_days}
                    onChange={(e) => setFormData({...formData, processing_days: parseInt(e.target.value)})}
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Crear Tipo
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Procedure Types List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Días Proc.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {procedureTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{type.name}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {type.area}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {type.processing_days} días
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={type.is_active ? 'default' : 'secondary'}>
                        {type.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {user?.role === 'ADMIN' && (
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
    </div>
  );
};

// Procedures Management Component
const ProceduresManagement = () => {
  const { user } = useContext(AuthContext);
  const [procedures, setProcedures] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    procedure_type_id: '',
    subject: '',
    description: '',
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    applicant_document: '',
    priority: 'NORMAL',
    observations: ''
  });

  useEffect(() => {
    fetchProcedures();
    fetchProcedureTypes();
  }, []);

  const fetchProcedures = async () => {
    try {
      const response = await axios.get(`${API}/mesa-partes/procedures`);
      setProcedures(response.data.procedures);
    } catch (error) {
      console.error('Error fetching procedures:', error);
      toast.error('Error al cargar trámites');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcedureTypes = async () => {
    try {
      const response = await axios.get(`${API}/mesa-partes/procedure-types`);
      setProcedureTypes(response.data.procedure_types.filter(type => type.is_active));
    } catch (error) {
      console.error('Error fetching procedure types:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/mesa-partes/procedures`, formData);
      toast.success('Trámite creado exitosamente');
      setIsCreateModalOpen(false);
      resetForm();
      fetchProcedures();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear trámite');
    }
  };

  const resetForm = () => {
    setFormData({
      procedure_type_id: '',
      subject: '',
      description: '',
      applicant_name: '',
      applicant_email: '',
      applicant_phone: '',
      applicant_document: '',
      priority: 'NORMAL',
      observations: ''
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'RECEIVED': { variant: 'secondary', label: 'Recibido' },
      'IN_PROCESS': { variant: 'default', label: 'En Proceso' },
      'COMPLETED': { variant: 'success', label: 'Completado' },
      'REJECTED': { variant: 'destructive', label: 'Rechazado' }
    };
    
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredProcedures = procedures.filter(procedure => {
    const matchesSearch = 
      procedure.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (procedure.applicant_name && procedure.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !statusFilter || statusFilter === 'ALL' || procedure.status === statusFilter;
    const matchesArea = !areaFilter || areaFilter === 'ALL' || procedure.area === areaFilter;
    
    return matchesSearch && matchesStatus && matchesArea;
  });

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
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Trámites</h2>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Trámite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Trámite</DialogTitle>
              <DialogDescription>
                Complete los datos del trámite para iniciarlo en el sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="procedure-type">Tipo de Trámite *</Label>
                <Select value={formData.procedure_type_id} onValueChange={(value) => setFormData({...formData, procedure_type_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione el tipo de trámite" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedureTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="subject">Asunto *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                  placeholder="Ingrese el asunto del trámite"
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                  placeholder="Describa detalladamente el trámite solicitado"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="applicant_name">Nombre del Solicitante</Label>
                  <Input
                    id="applicant_name"
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({...formData, applicant_name: e.target.value})}
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_document">Documento</Label>
                  <Input
                    id="applicant_document"
                    value={formData.applicant_document}
                    onChange={(e) => setFormData({...formData, applicant_document: e.target.value})}
                    placeholder="DNI o documento"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="applicant_email">Correo Electrónico</Label>
                  <Input
                    id="applicant_email"
                    type="email"
                    value={formData.applicant_email}
                    onChange={(e) => setFormData({...formData, applicant_email: e.target.value})}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_phone">Teléfono</Label>
                  <Input
                    id="applicant_phone"
                    value={formData.applicant_phone}
                    onChange={(e) => setFormData({...formData, applicant_phone: e.target.value})}
                    placeholder="999-999-999"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => setFormData({...formData, observations: e.target.value})}
                  placeholder="Observaciones adicionales"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Trámite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por código, asunto o solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="IN_PROCESS">En Proceso</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="REJECTED">Rechazado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las áreas</SelectItem>
            <SelectItem value="ACADEMIC">Académica</SelectItem>
            <SelectItem value="ADMINISTRATIVE">Administrativa</SelectItem>
            <SelectItem value="FINANCIAL">Financiera</SelectItem>
            <SelectItem value="HR">Recursos Humanos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Procedures List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asunto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProcedures.map((procedure) => (
                  <tr key={procedure.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{procedure.tracking_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{procedure.subject}</div>
                        <div className="text-sm text-gray-500">
                          {procedure.procedure_type_info?.[0]?.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {procedure.applicant_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">{procedure.applicant_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(procedure.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {procedure.area}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(procedure.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'ADMIN_WORKER') && (
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

      {filteredProcedures.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron trámites</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter || areaFilter 
              ? 'No hay trámites que coincidan con los filtros aplicados.' 
              : 'Aún no hay trámites registrados en el sistema.'
            }
          </p>
          {!searchTerm && !statusFilter && !areaFilter && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Trámite
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Public Tracking Component
const PublicTracking = () => {
  const [trackingCode, setTrackingCode] = useState('');
  const [procedure, setProcedure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTracking = async (e) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;

    setLoading(true);
    setError(null);
    setProcedure(null);

    try {
      const response = await axios.get(`${API}/mesa-partes/procedures/${trackingCode}`);
      setProcedure(response.data.procedure);
    } catch (error) {
      if (error.response?.status === 404) {
        setError('Trámite no encontrado. Verifique el código ingresado.');
      } else {
        setError('Error al consultar el trámite. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Seguimiento de Trámite</h2>
        <p className="text-gray-600">Consulte el estado de su trámite ingresando el código de seguimiento</p>
      </div>

      {/* Tracking Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleTracking} className="space-y-4">
            <div>
              <Label htmlFor="tracking-code">Código de Seguimiento</Label>
              <div className="flex gap-2">
                <Input
                  id="tracking-code"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ej: IESPP-20241201-ABC123"
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

      {/* Procedure Details */}
      {procedure && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información del Trámite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Código de Seguimiento</Label>
                  <div className="font-mono font-bold text-lg">{procedure.tracking_code}</div>
                </div>
                <div>
                  <Label>Estado Actual</Label>
                  <div className="mt-1">
                    {procedure.status === 'RECEIVED' && <Badge variant="secondary">Recibido</Badge>}
                    {procedure.status === 'IN_PROCESS' && <Badge variant="default">En Proceso</Badge>}
                    {procedure.status === 'COMPLETED' && <Badge variant="success">Completado</Badge>}
                    {procedure.status === 'REJECTED' && <Badge variant="destructive">Rechazado</Badge>}
                  </div>
                </div>
                <div>
                  <Label>Asunto</Label>
                  <div>{procedure.subject}</div>
                </div>
                <div>
                  <Label>Tipo de Trámite</Label>
                  <div>{procedure.procedure_type || 'N/A'}</div>
                </div>
                <div>
                  <Label>Fecha de Presentación</Label>
                  <div>{new Date(procedure.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <Label>Fecha Límite</Label>
                  <div>{new Date(procedure.deadline).toLocaleDateString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {procedure.timeline && procedure.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Historial del Trámite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {procedure.timeline.map((event, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-blue-600 rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{event.action}</div>
                        {event.comment && (
                          <div className="text-sm text-gray-600">{event.comment}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(event.performed_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// Main Mesa de Partes Module Component
const MesaDePartesModule = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="p-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="procedures">Trámites</TabsTrigger>
          <TabsTrigger value="tracking">Seguimiento</TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="procedure-types">Tipos</TabsTrigger>
          )}
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <MesaPartesDashboard />
        </TabsContent>
        
        <TabsContent value="procedures">
          <ProceduresManagement />
        </TabsContent>

        <TabsContent value="tracking">
          <PublicTracking />
        </TabsContent>
        
        {user?.role === 'ADMIN' && (
          <TabsContent value="procedure-types">
            <ProcedureTypesManagement />
          </TabsContent>
        )}
        
        <TabsContent value="reports">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Reportes de Mesa de Partes</h2>
            <p className="text-gray-600">Sistema de reportes y estadísticas de trámites.</p>
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

export default MesaDePartesModule;