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
import { Progress } from './ui/progress';
import { 
  Database,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Send,
  Eye,
  Settings,
  Sync,
  Shield,
  Users,
  BookOpen,
  Award,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { toast } from '../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

// MINEDU Dashboard Component
const MineduDashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/minedu/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching MINEDU stats:', error);
      toast.error('Error al cargar estadísticas MINEDU');
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
          <h2 className="text-3xl font-bold tracking-tight">Integración MINEDU</h2>
          <p className="text-muted-foreground">
            Sistema de integración con MINEDU - SIA/SIAGIE para exportación de datos académicos
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportaciones Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.pending_exports || 0}</div>
            <p className="text-xs text-muted-foreground">Por procesar</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportaciones Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.stats?.completed_exports || 0}</div>
            <p className="text-xs text-muted-foreground">Enviadas exitosamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportaciones Fallidas</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.stats?.failed_exports || 0}</div>
            <p className="text-xs text-muted-foreground">Con errores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.stats?.success_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">Exportaciones exitosas</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Tipo de Datos</CardTitle>
          <CardDescription>
            Cantidad de exportaciones por tipo de información académica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="font-semibold">Matrículas</div>
                  <div className="text-sm text-gray-500">Datos de estudiantes</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.data_breakdown?.enrollment_exports || 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Award className="h-8 w-8 text-green-600" />
                <div>
                  <div className="font-semibold">Calificaciones</div>
                  <div className="text-sm text-gray-500">Notas y evaluaciones</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {stats.data_breakdown?.grades_exports || 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="font-semibold">Estudiantes</div>
                  <div className="text-sm text-gray-500">Información personal</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.data_breakdown?.students_exports || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>
            Últimas exportaciones realizadas al sistema MINEDU
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recent_activity && stats.recent_activity.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_activity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      activity.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                      activity.status === 'FAILED' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {activity.status === 'COMPLETED' ? <CheckCircle className="h-4 w-4" /> :
                       activity.status === 'FAILED' ? <XCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium">{activity.data_type}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      activity.status === 'COMPLETED' ? 'success' :
                      activity.status === 'FAILED' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay actividad reciente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Operaciones comunes de exportación e integración con MINEDU
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Upload className="h-6 w-6" />
              <span className="text-sm">Exportar Matrículas</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              <span className="text-sm">Exportar Calificaciones</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Shield className="h-6 w-6" />
              <span className="text-sm">Validar Integridad</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <BarChart3 className="h-6 w-6" />
              <span className="text-sm">Ver Reportes</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Export Data Component
const ExportDataModule = () => {
  const { user } = useContext(AuthContext);
  const [exportType, setExportType] = useState('');
  const [academicYear, setAcademicYear] = useState(2024);
  const [academicPeriod, setAcademicPeriod] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async (e) => {
    e.preventDefault();
    
    if (!exportType || !academicPeriod) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    setLoading(true);

    try {
      const endpoint = exportType === 'enrollments' ? 
        'minedu/export/enrollments' : 
        'minedu/export/grades';

      const response = await axios.post(`${API}/${endpoint}`, {
        academic_year: academicYear,
        academic_period: academicPeriod
      });

      toast.success(response.data.message);
      
      // Reset form
      setExportType('');
      setAcademicPeriod('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar exportación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Exportación de Datos</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exportar Datos a MINEDU</CardTitle>
          <CardDescription>
            Seleccione el tipo de datos y período académico para exportar al sistema MINEDU
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExport} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="exportType">Tipo de Exportación *</Label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo de datos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrollments">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Matrículas de Estudiantes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="grades">
                      <div className="flex items-center space-x-2">
                        <Award className="h-4 w-4" />
                        <span>Calificaciones y Notas</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="academicYear">Año Académico *</Label>
                <Select value={academicYear.toString()} onValueChange={(value) => setAcademicYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="academicPeriod">Período Académico *</Label>
                <Select value={academicPeriod} onValueChange={setAcademicPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I Semestre</SelectItem>
                    <SelectItem value="II">II Semestre</SelectItem>
                    <SelectItem value="III">III Semestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <strong>Importante:</strong> Antes de exportar, asegúrese de que todos los datos estén 
                  completos y validados. La exportación incluirá todos los registros del período seleccionado 
                  que cumplan con los estándares de calidad de MINEDU.
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => {
                setExportType('');
                setAcademicPeriod('');
              }}>
                Limpiar
              </Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Iniciar Exportación
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Exportación de Matrículas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• Información personal de estudiantes</p>
              <p>• Datos de matrícula por período</p>
              <p>• Programas de estudio y especialidades</p>
              <p>• Estados de matrícula y traslados</p>
              <p>• Vinculación con códigos MINEDU</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-green-600" />
              <span>Exportación de Calificaciones</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• Notas numéricas y literales (0-20, AD/A/B/C)</p>
              <p>• Asistencia y porcentajes</p>
              <p>• Estados de aprobación/desaprobación</p>
              <p>• Evaluaciones parciales y finales</p>
              <p>• Actas oficiales y certificados</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Export History Component
const ExportHistoryModule = () => {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchExports();
  }, []);

  const fetchExports = async () => {
    try {
      const response = await axios.get(`${API}/minedu/exports`);
      setExports(response.data.exports || []);
    } catch (error) {
      console.error('Error fetching exports:', error);
      toast.error('Error al cargar historial de exportaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryExport = async (exportId) => {
    try {
      await axios.post(`${API}/minedu/exports/${exportId}/retry`);
      toast.success('Reintento de exportación iniciado');
      fetchExports();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reintentar exportación');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING': { variant: 'secondary', label: 'Pendiente', icon: Clock },
      'PROCESSING': { variant: 'default', label: 'Procesando', icon: RefreshCw },
      'COMPLETED': { variant: 'success', label: 'Completado', icon: CheckCircle },
      'FAILED': { variant: 'destructive', label: 'Fallido', icon: XCircle },
      'RETRYING': { variant: 'warning', label: 'Reintentando', icon: RefreshCw }
    };
    
    const config = statusConfig[status] || { variant: 'secondary', label: status, icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  const filteredExports = exports.filter(exp => {
    const matchesStatus = !statusFilter || statusFilter === 'ALL' || exp.status === statusFilter;
    const matchesType = !typeFilter || typeFilter === 'ALL' || exp.data_type === typeFilter;
    return matchesStatus && matchesType;
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
        <h2 className="text-2xl font-bold text-gray-900">Historial de Exportaciones</h2>
        <Button onClick={fetchExports} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="PROCESSING">Procesando</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="FAILED">Fallido</SelectItem>
            <SelectItem value="RETRYING">Reintentando</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="ENROLLMENT">Matrículas</SelectItem>
            <SelectItem value="GRADES">Calificaciones</SelectItem>
            <SelectItem value="STUDENTS">Estudiantes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exports List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registros</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExports.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {exp.data_type === 'ENROLLMENT' ? <Users className="h-4 w-4 text-blue-600" /> :
                         exp.data_type === 'GRADES' ? <Award className="h-4 w-4 text-green-600" /> :
                         <BookOpen className="h-4 w-4 text-purple-600" />}
                        <span className="font-medium">{exp.data_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exp.record_data?.academic_year}-{exp.record_data?.academic_period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(exp.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exp.total_records || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(exp.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {exp.status === 'FAILED' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRetryExport(exp.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
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

      {filteredExports.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron exportaciones</h3>
          <p className="text-gray-500">
            {statusFilter || typeFilter 
              ? 'No hay exportaciones que coincidan con los filtros aplicados.' 
              : 'Aún no se han realizado exportaciones al sistema MINEDU.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Data Validation Component
const DataValidationModule = () => {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/minedu/validation/data-integrity`);
      setValidation(response.data);
      
      if (response.data.valid) {
        toast.success('Validación completada: Datos íntegros');
      } else {
        toast.warning('Validación completada: Se encontraron inconsistencias');
      }
    } catch (error) {
      toast.error('Error al ejecutar validación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Validación de Integridad</h2>
        <Button onClick={runValidation} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Ejecutar Validación
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validación de Integridad de Datos</CardTitle>
          <CardDescription>
            Verificación de la calidad e integridad de los datos antes de la exportación a MINEDU
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validation ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg border ${
                validation.valid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-3">
                  {validation.valid ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <h3 className={`font-semibold ${
                      validation.valid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {validation.valid ? 'Datos Válidos' : 'Se Encontraron Problemas'}
                    </h3>
                    <p className={`text-sm ${
                      validation.valid ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {validation.valid 
                        ? 'Todos los datos están íntegros y listos para exportación'
                        : 'Se requiere corrección antes de exportar a MINEDU'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(validation.stats || {}).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {key.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {validation.errors && validation.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-800">Errores Encontrados:</h4>
                  <div className="space-y-2">
                    {validation.errors.map((error, index) => (
                      <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded">
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-red-700">{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings && validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-yellow-800">Advertencias:</h4>
                  <div className="space-y-2">
                    {validation.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-yellow-700">{warning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Validación de Integridad</h3>
              <p className="text-gray-500 mb-4">
                Ejecute la validación para verificar la integridad de los datos antes de exportar a MINEDU
              </p>
              <Button onClick={runValidation} disabled={loading}>
                <Shield className="h-4 w-4 mr-2" />
                Iniciar Validación
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main MINEDU Integration Module Component
const MineduIntegrationModule = () => {
  const { user } = useContext(AuthContext);

  if (!user || !['ADMIN', 'REGISTRAR'].includes(user.role)) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
        <p className="text-gray-600">
          Solo los administradores y registradores pueden acceder al módulo de integración MINEDU.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="export">Exportar Datos</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="validation">Validación</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <MineduDashboard />
        </TabsContent>
        
        <TabsContent value="export">
          <ExportDataModule />
        </TabsContent>
        
        <TabsContent value="history">
          <ExportHistoryModule />
        </TabsContent>
        
        <TabsContent value="validation">
          <DataValidationModule />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MineduIntegrationModule;