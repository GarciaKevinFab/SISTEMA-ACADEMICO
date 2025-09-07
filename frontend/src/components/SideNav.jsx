import React, { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { 
  GraduationCap, 
  FileText, 
  UserPlus, 
  Calculator,
  BarChart3,
  User 
} from 'lucide-react';

const SideNav = ({ activeModule, setActiveModule }) => {
  const { user } = useContext(AuthContext);

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