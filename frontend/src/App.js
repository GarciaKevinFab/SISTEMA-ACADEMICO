import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { toast } from 'sonner';
import { 
  User, 
  GraduationCap, 
  BookOpen, 
  Users, 
  Settings, 
  LogOut, 
  Plus, 
  Search,
  Eye,
  Edit,
  Save,
  UserPlus,
  Calendar,
  Award,
  FileText,
  BarChart3,
  Home,
  Menu,
  X,
  FileCheck,
  Clock,
  Send,
  Filter,
  Download,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader
} from 'lucide-react';
import './App.css';

// Import Admission Components
import { PublicAdmissionCalls, ApplicantProfile } from './components/AdmissionModule';
import { AdmissionDashboard, AdmissionCallsManagement } from './components/AdmissionAdmin';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user } = response.data;
      
      setToken(access_token);
      setUser(user);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('¡Inicio de sesión exitoso!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar sesión');
      return false;
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { access_token, user } = response.data;
      
      setToken(access_token);
      setUser(user);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('¡Registro exitoso!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrarse');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Sesión cerrada correctamente');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'STUDENT',
    phone: ''
  });
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isLogin) {
      const success = await login(formData.username, formData.password);
      if (success) navigate('/dashboard');
    } else {
      const success = await register(formData);
      if (success) navigate('/dashboard');
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div 
          className="relative max-w-7xl mx-auto px-4 text-center bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(30, 64, 175, 0.8), rgba(30, 64, 175, 0.8)), url('https://images.unsplash.com/photo-1736066330610-c102cab4e942?w=1200&h=600&fit=crop')`
          }}
        >
          <div className="py-20">
            <h1 className="text-5xl font-bold mb-6 font-crimson">
              Sistema Integral Académico
            </h1>
            <h2 className="text-3xl font-semibold mb-4">
              IESPP "Gustavo Allende Llavería"
            </h2>
            <p className="text-xl mb-8 max-w-3xl mx-auto leading-relaxed">
              Plataforma moderna para la gestión académica y administrativa. 
              Integración completa con el SIA del MINEDU para garantizar 
              transparencia y cumplimiento de las Condiciones Básicas de Calidad.
            </p>
            <div className="flex justify-center gap-6 mb-12">
              <div className="flex items-center gap-2">
                <Award className="h-6 w-6" />
                <span>Certificación Digital</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                <span>Integración MINEDU</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                <span>Reportes Académicos</span>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Link to="/admision">
                <Button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Ver Convocatorias
                </Button>
              </Link>
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 text-lg">
                <FileText className="h-5 w-5 mr-2" />
                Conocer Más
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Módulos del Sistema</h3>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Solución integral que optimiza todos los procesos académicos y administrativos
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center pb-4">
                <img 
                  src="https://images.unsplash.com/photo-1514355315815-2b64b0216b14?w=400&h=200&fit=crop" 
                  alt="Gestión Académica"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <CardTitle className="flex items-center justify-center gap-2 text-blue-700">
                  <GraduationCap className="h-6 w-6" />
                  Gestión Académica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Matrícula de estudiantes</li>
                  <li>• Asignación docente</li>
                  <li>• Gestión de notas y asistencia</li>
                  <li>• Reportes académicos</li>
                  <li>• Actas de calificaciones</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center pb-4">
                <img 
                  src="https://images.unsplash.com/photo-1706645740995-d3ab4b91f4fa?w=400&h=200&fit=crop" 
                  alt="Mesa de Partes Virtual"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <CardTitle className="flex items-center justify-center gap-2 text-green-700">
                  <FileText className="h-6 w-6" />
                  Mesa de Partes Virtual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Registro digital de trámites</li>
                  <li>• Seguimiento online</li>
                  <li>• Notificaciones automáticas</li>
                  <li>• Control de plazos</li>
                  <li>• Adjuntos digitales</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center pb-4">
                <img 
                  src="https://images.pexels.com/photos/33755567/pexels-photo-33755567.jpeg?w=400&h=200&fit=crop" 
                  alt="Proceso de Admisión"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <CardTitle className="flex items-center justify-center gap-2 text-purple-700">
                  <Award className="h-6 w-6" />
                  Proceso de Admisión
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Convocatorias de admisión</li>
                  <li>• Registro de postulantes</li>
                  <li>• Evaluación y resultados</li>
                  <li>• Constancias digitales</li>
                  <li>• Integración MINEDU</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? 'Acceda al sistema académico con sus credenciales' 
                  : 'Registre una nueva cuenta en el sistema'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Ingrese su usuario"
                  />
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="full_name">Nombre Completo</Label>
                      <Input
                        id="full_name"
                        name="full_name"
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={handleInputChange}
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Rol</Label>
                      <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Estudiante</SelectItem>
                          <SelectItem value="TEACHER">Docente</SelectItem>
                          <SelectItem value="ADMIN">Administrador</SelectItem>
                          <SelectItem value="REGISTRAR">Registrador</SelectItem>
                          <SelectItem value="ADMIN_WORKER">Trabajador Administrativo</SelectItem>
                          <SelectItem value="EXTERNAL_USER">Usuario Externo</SelectItem>
                          <SelectItem value="APPLICANT">Postulante</SelectItem>
                          <SelectItem value="ACADEMIC_STAFF">Personal Académico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="phone">Teléfono (Opcional)</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Número de teléfono"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Ingrese su contraseña"
                  />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </Button>
              </form>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {isLogin 
                    ? '¿No tiene cuenta? Regístrese aquí' 
                    : '¿Ya tiene cuenta? Inicie sesión'
                  }
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Dashboard Components
const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'REGISTRAR', 'ADMIN_WORKER', 'EXTERNAL_USER', 'APPLICANT', 'ACADEMIC_STAFF'] },
    { name: 'Estudiantes', href: '/dashboard/students', icon: Users, roles: ['ADMIN', 'REGISTRAR', 'TEACHER'] },
    { name: 'Cursos', href: '/dashboard/courses', icon: BookOpen, roles: ['ADMIN', 'TEACHER'] },
    { name: 'Matrículas', href: '/dashboard/enrollments', icon: UserPlus, roles: ['ADMIN', 'REGISTRAR', 'TEACHER'] },
    { name: 'Calificaciones', href: '/dashboard/grades', icon: Award, roles: ['ADMIN', 'TEACHER'] },
    { name: 'Mesa de Partes', href: '/dashboard/procedures', icon: FileCheck, roles: ['ADMIN', 'ADMIN_WORKER', 'EXTERNAL_USER'] },
    { name: 'Admisión', href: '/dashboard/admission', icon: GraduationCap, roles: ['ADMIN', 'ACADEMIC_STAFF', 'APPLICANT'] },
    { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['ADMIN', 'REGISTRAR'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">IESPP Sistema</span>
            </div>
            <nav className="mt-5 space-y-1 px-2">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-900 hover:bg-gray-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white shadow-lg">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">IESPP Sistema</span>
            </div>
            <nav className="mt-8 flex-1 space-y-1 px-2">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <item.icon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 bg-gray-50 p-4">
            <div className="group block w-full flex-shrink-0">
              <div className="flex items-center">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white font-medium">
                  {user?.full_name?.charAt(0) || user?.username?.charAt(0)}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.full_name}</p>
                  <Badge variant="outline" className="text-xs">{user?.role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="ml-2"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="h-6 w-px bg-gray-200 lg:hidden" />
            <div className="flex flex-1 items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">
                Sistema Académico - IESPP "Gustavo Allende Llavería"
              </h1>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {user?.role}
                </Badge>
                <span className="text-sm text-gray-700 hidden sm:block">
                  {user?.full_name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Bienvenido, {user?.full_name}
        </h2>
        <Badge variant="outline" className="text-sm">
          {user?.role === 'ADMIN' && 'Administrador'}
          {user?.role === 'TEACHER' && 'Docente'}
          {user?.role === 'STUDENT' && 'Estudiante'}
          {user?.role === 'REGISTRAR' && 'Registrador'}
          {user?.role === 'ADMIN_WORKER' && 'Trabajador Administrativo'}
          {user?.role === 'EXTERNAL_USER' && 'Usuario Externo'}
          {user?.role === 'APPLICANT' && 'Postulante'}
          {user?.role === 'ACADEMIC_STAFF' && 'Personal Académico'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.total_students || 0}</div>
                  <p className="text-xs text-muted-foreground">Estudiantes activos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cursos</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.total_courses || 0}</div>
                  <p className="text-xs text-muted-foreground">Cursos disponibles</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Matrículas</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{stats.total_enrollments || 0}</div>
                  <p className="text-xs text-muted-foreground">Matrículas activas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trámites Pendientes</CardTitle>
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.pending_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Mesa de Partes</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'ADMIN_WORKER' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Trámites</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.total_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Trámites registrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Asignados a mí</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.my_assigned_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Trámites asignados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.pending_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Por procesar</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'EXTERNAL_USER' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mis Trámites</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.my_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Total registrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.my_pending_procedures || 0}</div>
                  <p className="text-xs text-muted-foreground">Pendiente</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'APPLICANT' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mis Postulaciones</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.my_applications || 0}</div>
                  <p className="text-xs text-muted-foreground">Total postulaciones</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.pending_applications || 0}</div>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'ACADEMIC_STAFF' && (
            <>
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
                  <CardTitle className="text-sm font-medium">Pendiente Evaluación</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.pending_evaluations || 0}</div>
                  <p className="text-xs text-muted-foreground">Por evaluar</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {(user?.role === 'ADMIN') && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Convocatorias Activas</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.active_admission_calls || 0}</div>
                  <p className="text-xs text-muted-foreground">Abiertas</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'TEACHER' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mis Cursos</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.my_courses || 0}</div>
                  <p className="text-xs text-muted-foreground">Cursos asignados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calificaciones Pendientes</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.pending_grades || 0}</div>
                  <p className="text-xs text-muted-foreground">Por calificar</p>
                </CardContent>
              </Card>
            </>
          )}
          
          {user?.role === 'STUDENT' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mis Matrículas</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.my_enrollments || 0}</div>
                  <p className="text-xs text-muted-foreground">Cursos matriculados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cursos Aprobados</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.approved_courses || 0}</div>
                  <p className="text-xs text-muted-foreground">Cursos completados</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Accede a las funciones más utilizadas del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(user?.role === 'ADMIN' || user?.role === 'REGISTRAR') && (
              <>
                <Link to="/dashboard/students">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Gestionar Estudiantes</span>
                  </Button>
                </Link>
                <Link to="/dashboard/enrollments">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <UserPlus className="h-6 w-6" />
                    <span className="text-sm">Nueva Matrícula</span>
                  </Button>
                </Link>
              </>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'TEACHER') && (
              <>
                <Link to="/dashboard/courses">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <BookOpen className="h-6 w-6" />
                    <span className="text-sm">Gestionar Cursos</span>
                  </Button>
                </Link>
                <Link to="/dashboard/grades">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <Award className="h-6 w-6" />
                    <span className="text-sm">Calificar</span>
                  </Button>
                </Link>
              </>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'ADMIN_WORKER' || user?.role === 'EXTERNAL_USER') && (
              <>
                <Link to="/dashboard/procedures">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <FileCheck className="h-6 w-6" />
                    <span className="text-sm">Mesa de Partes</span>
                  </Button>
                </Link>
                {user?.role === 'EXTERNAL_USER' && (
                  <Link to="/dashboard/procedures/new">
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                      <Plus className="h-6 w-6" />
                      <span className="text-sm">Nuevo Trámite</span>
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Students Management
const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
    program: '',
    entry_year: new Date().getFullYear(),
    has_disability: false,
    disability_description: '',
    support_needs: []
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API}/students`);
      setStudents(response.data.students);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/students`, formData);
      toast.success('Estudiante creado exitosamente');
      setIsCreateModalOpen(false);
      setFormData({
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
        program: '',
        entry_year: new Date().getFullYear(),
        has_disability: false,
        disability_description: '',
        support_needs: []
      });
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear estudiante');
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.document_number.includes(searchTerm) ||
      student.student_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProgram = !selectedProgram || selectedProgram === 'ALL' || student.program === selectedProgram;
    
    return matchesSearch && matchesProgram;
  });

  const uniquePrograms = [...new Set(students.map(s => s.program))];

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
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Estudiantes</h2>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Estudiante
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Estudiante</DialogTitle>
              <DialogDescription>
                Complete los datos del estudiante para registrarlo en el sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="second_last_name">Apellido Materno</Label>
                  <Input
                    id="second_last_name"
                    value={formData.second_last_name}
                    onChange={(e) => setFormData({...formData, second_last_name: e.target.value})}
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <div>
                  <Label htmlFor="document_number">Número de Documento *</Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({...formData, document_number: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
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
                  <Label htmlFor="program">Programa de Estudios *</Label>
                  <Input
                    id="program"
                    value={formData.program}
                    onChange={(e) => setFormData({...formData, program: e.target.value})}
                    required
                    placeholder="Ej: Educación Inicial, Educación Primaria"
                  />
                </div>
                <div>
                  <Label htmlFor="entry_year">Año de Ingreso *</Label>
                  <Input
                    id="entry_year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.entry_year}
                    onChange={(e) => setFormData({...formData, entry_year: parseInt(e.target.value)})}
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
                  <div>
                    <Label htmlFor="disability_description">Descripción de la Discapacidad</Label>
                    <Textarea
                      id="disability_description"
                      value={formData.disability_description}
                      onChange={(e) => setFormData({...formData, disability_description: e.target.value})}
                      placeholder="Describa el tipo de discapacidad y necesidades especiales"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Estudiante
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
              placeholder="Buscar por nombre, DNI o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedProgram} onValueChange={setSelectedProgram}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por programa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los programas</SelectItem>
            {uniquePrograms.map(program => (
              <SelectItem key={program} value={program}>{program}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Programa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student.first_name} {student.last_name} {student.second_last_name}
                        </div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.student_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.document_type}: {student.document_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.program}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={student.status === 'ENROLLED' ? 'default' : 'secondary'}>
                        {student.status === 'ENROLLED' ? 'Matriculado' : student.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
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

      {filteredStudents.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron estudiantes</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || selectedProgram 
              ? 'No hay estudiantes que coincidan con los filtros aplicados.' 
              : 'Aún no hay estudiantes registrados en el sistema.'
            }
          </p>
          {!searchTerm && !selectedProgram && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primer Estudiante
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Placeholder components for other pages
const CoursesPage = () => <div className="p-6"><h2 className="text-2xl font-bold">Gestión de Cursos</h2><p className="text-gray-600 mt-2">Funcionalidad en desarrollo...</p></div>;
const EnrollmentsPage = () => <div className="p-6"><h2 className="text-2xl font-bold">Gestión de Matrículas</h2><p className="text-gray-600 mt-2">Funcionalidad en desarrollo...</p></div>;
const GradesPage = () => <div className="p-6"><h2 className="text-2xl font-bold">Gestión de Calificaciones</h2><p className="text-gray-600 mt-2">Funcionalidad en desarrollo...</p></div>;
const ReportsPage = () => <div className="p-6"><h2 className="text-2xl font-bold">Reportes Académicos</h2><p className="text-gray-600 mt-2">Funcionalidad en desarrollo...</p></div>;

// Admission Module Main Component
const AdmissionPage = () => {
  const { user } = useAuth();

  if (user?.role === 'APPLICANT') {
    return <ApplicantProfile />;
  }

  if (user?.role === 'ADMIN') {
    return (
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="convocatorias">Convocatorias</TabsTrigger>
          <TabsTrigger value="postulantes">Postulantes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <AdmissionDashboard />
        </TabsContent>
        
        <TabsContent value="convocatorias">
          <AdmissionCallsManagement />
        </TabsContent>
        
        <TabsContent value="postulantes">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Gestión de Postulantes</h2>
            <p className="text-gray-600 mt-2">Panel de gestión de postulantes en desarrollo...</p>
          </div>
        </TabsContent>
      </Tabs>
    );
  }

  if (user?.role === 'ACADEMIC_STAFF') {
    return (
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="evaluaciones">Evaluaciones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <AdmissionDashboard />
        </TabsContent>
        
        <TabsContent value="evaluaciones">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Gestión de Evaluaciones</h2>
            <p className="text-gray-600 mt-2">Sistema de evaluaciones en desarrollo...</p>
          </div>
        </TabsContent>
      </Tabs>
    );
  }

  // Default view for other roles
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">Módulo de Admisión</h2>
      <p className="text-gray-600 mt-2">
        Acceso no autorizado para el rol actual: {user?.role}
      </p>
    </div>
  );
};

// Mesa de Partes Components
const ProceduresPage = () => {
  const { user } = useAuth();
  const [procedures, setProcedures] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
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
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedArea) params.append('area', selectedArea);
      
      const response = await axios.get(`${API}/procedures?${params.toString()}`);
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

  const handleCreateProcedure = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/procedures`, formData);
      toast.success(`Trámite creado exitosamente. Código: ${response.data.tracking_code}`);
      setIsCreateModalOpen(false);
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
      fetchProcedures();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear trámite');
    }
  };

  const handleTrackProcedure = async () => {
    try {
      const response = await axios.get(`${API}/procedures/tracking/${trackingCode}`);
      setTrackingResult(response.data);
    } catch (error) {
      toast.error('No se encontró el trámite con ese código');
      setTrackingResult(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'RECEIVED': { color: 'bg-blue-100 text-blue-800', label: 'Recibido', icon: FileText },
      'IN_PROCESS': { color: 'bg-yellow-100 text-yellow-800', label: 'En Proceso', icon: Clock },
      'COMPLETED': { color: 'bg-green-100 text-green-800', label: 'Finalizado', icon: CheckCircle },
      'REJECTED': { color: 'bg-red-100 text-red-800', label: 'Rechazado', icon: XCircle },
      'PENDING_INFO': { color: 'bg-orange-100 text-orange-800', label: 'Pendiente Info', icon: AlertCircle }
    };
    
    const config = statusConfig[status] || statusConfig['RECEIVED'];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      'LOW': { color: 'bg-gray-100 text-gray-800', label: 'Baja' },
      'NORMAL': { color: 'bg-blue-100 text-blue-800', label: 'Normal' },
      'HIGH': { color: 'bg-orange-100 text-orange-800', label: 'Alta' },
      'URGENT': { color: 'bg-red-100 text-red-800', label: 'Urgente' }
    };
    
    const config = priorityConfig[priority] || priorityConfig['NORMAL'];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const filteredProcedures = procedures.filter(procedure => {
    const matchesSearch = 
      procedure.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (procedure.applicant_name && procedure.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
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
        <h2 className="text-2xl font-bold text-gray-900">Mesa de Partes Virtual</h2>
        <div className="flex gap-2">
          <Dialog open={isTrackingModalOpen} onOpenChange={setIsTrackingModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Rastrear Trámite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rastrear Trámite</DialogTitle>
                <DialogDescription>
                  Ingrese el código de seguimiento para ver el estado de su trámite
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tracking_code">Código de Seguimiento</Label>
                  <Input
                    id="tracking_code"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="IESPP-20241206-ABC12345"
                  />
                </div>
                <Button onClick={handleTrackProcedure} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Trámite
                </Button>
                
                {trackingResult && (
                  <div className="mt-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">{trackingResult.subject}</h4>
                    <p className="text-sm text-gray-600 mb-2">Código: {trackingResult.tracking_code}</p>
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(trackingResult.status)}
                    </div>
                    <p className="text-xs text-gray-500">
                      Creado: {new Date(trackingResult.created_at).toLocaleDateString()}
                    </p>
                    {trackingResult.deadline && (
                      <p className="text-xs text-gray-500">
                        Plazo: {new Date(trackingResult.deadline).toLocaleDateString()}
                      </p>
                    )}
                    
                    {trackingResult.timeline && trackingResult.timeline.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-medium text-sm mb-2">Cronología:</h5>
                        <div className="space-y-2">
                          {trackingResult.timeline.map((event, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                              <span>{new Date(event.date).toLocaleDateString()}</span>
                              <span className="font-medium">{event.status || event.action}</span>
                              {event.comment && <span className="text-gray-600">- {event.comment}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          {user?.role === 'EXTERNAL_USER' && (
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
                    Complete los datos del trámite que desea registrar
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProcedure} className="space-y-4">
                  <div>
                    <Label htmlFor="procedure_type_id">Tipo de Trámite *</Label>
                    <Select 
                      value={formData.procedure_type_id} 
                      onValueChange={(value) => setFormData({...formData, procedure_type_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione tipo de trámite" />
                      </SelectTrigger>
                      <SelectContent>
                        {procedureTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} - {type.area}
                          </SelectItem>
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
                      placeholder="Asunto del trámite"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Descripción *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      required
                      placeholder="Describa detalladamente su solicitud"
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="applicant_name">Nombre Completo *</Label>
                      <Input
                        id="applicant_name"
                        value={formData.applicant_name}
                        onChange={(e) => setFormData({...formData, applicant_name: e.target.value})}
                        required
                        placeholder="Nombres y apellidos"
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
                      <Label htmlFor="applicant_email">Email *</Label>
                      <Input
                        id="applicant_email"
                        type="email"
                        value={formData.applicant_email}
                        onChange={(e) => setFormData({...formData, applicant_email: e.target.value})}
                        required
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="applicant_phone">Teléfono</Label>
                      <Input
                        id="applicant_phone"
                        value={formData.applicant_phone}
                        onChange={(e) => setFormData({...formData, applicant_phone: e.target.value})}
                        placeholder="Número de teléfono"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select 
                      value={formData.priority} 
                      onValueChange={(value) => setFormData({...formData, priority: value})}
                    >
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
                      placeholder="Información adicional (opcional)"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      Registrar Trámite
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por asunto, código o solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="IN_PROCESS">En Proceso</SelectItem>
            <SelectItem value="COMPLETED">Finalizado</SelectItem>
            <SelectItem value="REJECTED">Rechazado</SelectItem>
            <SelectItem value="PENDING_INFO">Pendiente Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las áreas</SelectItem>
            <SelectItem value="ACADEMIC">Académica</SelectItem>
            <SelectItem value="ADMINISTRATIVE">Administrativa</SelectItem>
            <SelectItem value="FINANCIAL">Financiera</SelectItem>
            <SelectItem value="LEGAL">Legal</SelectItem>
            <SelectItem value="HR">Recursos Humanos</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trámite</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProcedures.map((procedure) => (
                  <tr key={procedure.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {procedure.subject}
                        </div>
                        <div className="text-sm text-gray-500">
                          {procedure.procedure_type?.name} - {procedure.area}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {procedure.tracking_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {procedure.applicant_name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {procedure.applicant_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(procedure.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPriorityBadge(procedure.priority)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          <FileCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron trámites</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || selectedStatus || selectedArea
              ? 'No hay trámites que coincidan con los filtros aplicados.'
              : 'Aún no hay trámites registrados en el sistema.'
            }
          </p>
          {user?.role === 'EXTERNAL_USER' && !searchTerm && !selectedStatus && !selectedArea && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primer Trámite
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admision" element={<PublicAdmissionCalls />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/students" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <StudentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/courses" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CoursesPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/enrollments" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EnrollmentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/grades" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <GradesPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/reports" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ReportsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/procedures" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProceduresPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/admission" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AdmissionPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default App;