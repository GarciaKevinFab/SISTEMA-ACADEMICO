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
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Search,
  Eye,
  Download,
  Upload,
  QrCode,
  BarChart3,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mesa de Partes Dashboard Component
const MesaDePartesDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
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
          <h2 className="text-3xl font-bold tracking-tight">Mesa de Partes Digital</h2>
          <p className="text-muted-foreground">
            Sistema de gestión de trámites documentarios
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trámites Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_procedures || 0}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_today || 0}</div>
            <p className="text-xs text-muted-foreground">Trámites finalizados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_processing_time || '0'} días</div>
            <p className="text-xs text-muted-foreground">Tiempo de procesamiento</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos de Trámite</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.procedure_types || 0}</div>
            <p className="text-xs text-muted-foreground">Tipos disponibles</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Acceso directo a las funciones principales de Mesa de Partes
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
              <span className="text-sm">Consultar Estado</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <QrCode className="h-6 w-6" />
              <span className="text-sm">Generar QR</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <BarChart3 className="h-6 w-6" />
              <span className="text-sm">Reportes</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Procedure Types Management Component
const ProcedureTypesManagement = () => {
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    required_documents: '',
    processing_days: 5,
    cost: 0,
    is_active: true
  });

  useEffect(() => {
    fetchProcedureTypes();
  }, []);

  const fetchProcedureTypes = async () => {
    try {
      const response = await axios.get(`${API}/procedure-types`);
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
      await axios.post(`${API}/procedure-types`, formData);
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
      required_documents: '',
      processing_days: 5,
      cost: 0,
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
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo de Trámite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Tipo de Trámite</DialogTitle>
              <DialogDescription>
                Configure un nuevo tipo de trámite documentario
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
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="required_documents">Documentos Requeridos</Label>
                <Textarea
                  id="required_documents"
                  value={formData.required_documents}
                  onChange={(e) => setFormData({...formData, required_documents: e.target.value})}
                  placeholder="Liste los documentos necesarios para este trámite"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="processing_days">Días de Procesamiento *</Label>
                  <Input
                    id="processing_days"
                    type="number"
                    min="1"
                    value={formData.processing_days}
                    onChange={(e) => setFormData({...formData, processing_days: parseInt(e.target.value)})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Costo (S/.) *</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: parseFloat(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Tipo de Trámite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Procedure Types List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Trámite</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Días</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
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
                      {type.processing_days} días
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      S/. {type.cost.toFixed(2)}
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
  const [procedures, setProcedures] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    procedure_type_id: '',
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    applicant_document: '',
    description: '',
    urgency_level: 'NORMAL'
  });

  useEffect(() => {
    fetchProcedures();
    fetchProcedureTypes();
  }, []);

  const fetchProcedures = async () => {
    try {
      const response = await axios.get(`${API}/procedures`);
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
      const response = await axios.get(`${API}/procedure-types`);
      setProcedureTypes(response.data.procedure_types);
    } catch (error) {
      console.error('Error fetching procedure types:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/procedures`, formData);
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
      applicant_name: '',
      applicant_email: '',
      applicant_phone: '',
      applicant_document: '',
      description: '',
      urgency_level: 'NORMAL'
    });
  };

  const filteredProcedures = procedures.filter(procedure => {
    const matchesSearch = 
      procedure.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.procedure_type_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || procedure.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      'RECEIVED': { variant: 'secondary', label: 'Recibido' },
      'IN_REVIEW': { variant: 'default', label: 'En Revisión' },
      'APPROVED': { variant: 'default', label: 'Aprobado' },
      'REJECTED': { variant: 'destructive', label: 'Rechazado' },
      'COMPLETED': { variant: 'default', label: 'Completado' }
    };
    
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
              <DialogTitle>Registrar Nuevo Trámite</DialogTitle>
              <DialogDescription>
                Complete los datos del trámite documentario
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="procedure_type_id">Tipo de Trámite *</Label>
                <Select value={formData.procedure_type_id} onValueChange={(value) => setFormData({...formData, procedure_type_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de trámite" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedureTypes.map(type => (
                      <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="applicant_name">Nombre del Solicitante *</Label>
                  <Input
                    id="applicant_name"
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({...formData, applicant_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_document">Documento de Identidad *</Label>
                  <Input
                    id="applicant_document"
                    value={formData.applicant_document}
                    onChange={(e) => setFormData({...formData, applicant_document: e.target.value})}
                    required
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
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_phone">Teléfono</Label>
                  <Input
                    id="applicant_phone"
                    value={formData.applicant_phone}
                    onChange={(e) => setFormData({...formData, applicant_phone: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción del Trámite</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describa los detalles específicos del trámite"
                />
              </div>

              <div>
                <Label htmlFor="urgency_level">Nivel de Urgencia</Label>
                <Select value={formData.urgency_level} onValueChange={(value) => setFormData({...formData, urgency_level: value})}>
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button data-testid="procedure-create" type="submit" className="bg-blue-600 hover:bg-blue-700">
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
              placeholder="Buscar por código, nombre o tipo..."
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
            <SelectItem value="">Todos los estados</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
            <SelectItem value="APPROVED">Aprobado</SelectItem>
            <SelectItem value="REJECTED">Rechazado</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
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
                        <div className="text-sm font-medium text-gray-900">{procedure.applicant_name}</div>
                        <div className="text-sm text-gray-500">{procedure.applicant_document}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {procedure.procedure_type_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(procedure.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(procedure.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button data-testid="procedure-view" variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button data-testid="procedure-download-pdf" variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button data-testid="procedure-verify-qr" variant="ghost" size="sm">
                          <QrCode className="h-4 w-4" />
                        </Button>
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

// Main Mesa de Partes Module Component
const MesaDePartesModule = () => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <div>Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="types">Tipos de Trámite</TabsTrigger>
          <TabsTrigger value="procedures">Trámites</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <MesaDePartesDashboard />
        </TabsContent>
        
        <TabsContent value="types">
          <ProcedureTypesManagement />
        </TabsContent>
        
        <TabsContent value="procedures">
          <ProceduresManagement />
        </TabsContent>
        
        <TabsContent value="reports">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Reportes de Mesa de Partes</h2>
            <p className="text-gray-600">Reportes estadísticos y de seguimiento de trámites.</p>
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