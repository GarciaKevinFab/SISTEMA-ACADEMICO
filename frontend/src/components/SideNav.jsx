import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { 
  GraduationCap, 
  FileText, 
  UserPlus, 
  Calculator,
  BarChart3,
  User,
  BookOpen,
  Building,
  Database
} from 'lucide-react';

const SideNav = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  // Check user permissions
  const hasAcademicAccess = ['ADMIN', 'TEACHER', 'STUDENT', 'REGISTRAR'].includes(user?.role);
  const hasAdmissionAccess = ['ADMIN', 'REGISTRAR', 'APPLICANT'].includes(user?.role);
  const hasMesaDePartesAccess = ['ADMIN', 'STUDENT', 'TEACHER', 'ADMIN_WORKER', 'APPLICANT'].includes(user?.role);
  const hasFinanceAccess = [
    'ADMIN', 
    'FINANCE_ADMIN', 
    'CASHIER', 
    'WAREHOUSE', 
    'HR_ADMIN', 
    'LOGISTICS'
  ].includes(user?.role);
  const hasMineduAccess = ['ADMIN', 'REGISTRAR'].includes(user?.role);
  const hasPortalAccess = ['ADMIN'].includes(user?.role);

  const menuItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      path: '/dashboard',
      icon: BarChart3,
      hasAccess: true
    },
    {
      id: 'academic',
      title: 'Académico',
      path: '/dashboard/academic',
      icon: BookOpen,
      hasAccess: hasAcademicAccess
    },
    {
      id: 'admission',
      title: 'Admisión',
      path: '/dashboard/admission',
      icon: GraduationCap,
      hasAccess: hasAdmissionAccess
    },
    {
      id: 'mesa-partes',
      title: 'Mesa de Partes',
      path: '/dashboard/mesa-partes',
      icon: FileText,
      hasAccess: hasMesaDePartesAccess
    },
    {
      id: 'finance',
      title: 'Tesorería',
      path: '/dashboard/finance',
      icon: Calculator,
      hasAccess: hasFinanceAccess
    },
    {
      id: 'minedu',
      title: 'MINEDU',
      path: '/dashboard/minedu',
      icon: Database,
      hasAccess: hasMineduAccess
    },
    {
      id: 'portal',
      title: 'Portal Web',
      path: '/dashboard/portal',
      icon: Building,
      hasAccess: hasPortalAccess
    }
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-gray-800 text-white w-64 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">IESPP</h1>
            <p className="text-xs text-gray-400">"Gustavo Allende Llavería"</p>
          </div>
        </div>
        
        {user && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.full_name}</div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
                <div className="text-xs text-blue-400">{user.role}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            if (!item.hasAccess) return null;
            
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        >
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );

  const navigationItems = [
    {
      id: 'academic',
      label: 'Módulo Académico',
      icon: GraduationCap,
      hasAccess: hasAcademicAccess
    },
    {
      id: 'mesa-de-partes',
      label: 'Mesa de Partes Virtual',
      icon: FileText,
      hasAccess: hasMesaDePartesAccess
    },
    {
      id: 'admission',
      label: 'Módulo de Admisión',
      icon: UserPlus,
      hasAccess: hasAdmissionAccess
    },
    {
      id: 'finance',
      label: 'Tesorería y Administración',
      icon: Calculator,
      hasAccess: hasFinanceAccess
    }
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-full">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">IESPP GAL</h1>
            <p className="text-sm text-gray-600">Sistema Integral</p>
          </div>
        </div>
      </div>

      <nav className="mt-6">
        <div className="px-3">
          {navigationItems.map((item) => {
            if (!item.hasAccess) return null;
            
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
        <div className="flex items-center space-x-3">
          <User className="h-8 w-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.username}</p>
            <p className="text-xs text-gray-600">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideNav;