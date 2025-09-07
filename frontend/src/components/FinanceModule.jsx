import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import CashBanksDashboard from './finance/CashBanksDashboard';
import ReceiptsDashboard from './finance/ReceiptsDashboard';
import InventoryDashboard from './finance/InventoryDashboard';
import LogisticsDashboard from './finance/LogisticsDashboard';
import HRDashboard from './finance/HRDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Banknote, 
  Receipt, 
  Package, 
  Truck, 
  Users, 
  BarChart3,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

const FinanceModule = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Determine user permissions based on role
  const hasFinanceAccess = ['FINANCE_ADMIN', 'ADMIN'].includes(user?.role);
  const hasCashierAccess = ['CASHIER', 'FINANCE_ADMIN', 'ADMIN'].includes(user?.role);
  const hasWarehouseAccess = ['WAREHOUSE', 'FINANCE_ADMIN', 'ADMIN'].includes(user?.role);
  const hasLogisticsAccess = ['LOGISTICS', 'FINANCE_ADMIN', 'ADMIN'].includes(user?.role);
  const hasHRAccess = ['HR_ADMIN', 'FINANCE_ADMIN', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Main dashboard with role-based cards
  const renderMainDashboard = () => (
    <div className="space-y-6">
      {/* Finance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {hasCashierAccess && (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Caja del Día</CardTitle>
              <Banknote className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">S/. 2,450.00</div>
              <p className="text-xs text-muted-foreground">
                Sesión actual abierta
              </p>
            </CardContent>
          </Card>
        )}

        {hasFinanceAccess && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">S/. 85,420.50</div>
              <p className="text-xs text-muted-foreground">
                +15% vs mes anterior
              </p>
            </CardContent>
          </Card>
        )}

        {hasWarehouseAccess && (
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">5</div>
              <p className="text-xs text-muted-foreground">
                Items con stock bajo
              </p>
            </CardContent>
          </Card>
        )}

        {hasHRAccess && (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Personal Activo</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">42</div>
              <p className="text-xs text-muted-foreground">
                Empleados registrados
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Accede rápidamente a las funciones principales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {hasCashierAccess && (
              <Button 
                onClick={() => setActiveTab('cash-banks')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
                variant="outline"
              >
                <Banknote className="h-6 w-6" />
                <span className="text-sm">Caja y Bancos</span>
              </Button>
            )}

            {hasCashierAccess && (
              <Button 
                onClick={() => setActiveTab('receipts')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
                variant="outline"
              >
                <Receipt className="h-6 w-6" />
                <span className="text-sm">Boletas</span>
              </Button>
            )}

            {hasWarehouseAccess && (
              <Button 
                onClick={() => setActiveTab('inventory')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
                variant="outline"
              >
                <Package className="h-6 w-6" />
                <span className="text-sm">Inventario</span>
              </Button>
            )}

            {hasLogisticsAccess && (
              <Button 
                onClick={() => setActiveTab('logistics')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
                variant="outline"
              >
                <Truck className="h-6 w-6" />
                <span className="text-sm">Logística</span>
              </Button>
            )}

            {hasHRAccess && (
              <Button 
                onClick={() => setActiveTab('hr')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
                variant="outline"
              >
                <Users className="h-6 w-6" />
                <span className="text-sm">Recursos Humanos</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividades Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Boleta REC-001-000125 pagada</p>
                  <p className="text-xs text-muted-foreground">Hace 5 minutos</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Movimiento de inventario: Entrada</p>
                  <p className="text-xs text-muted-foreground">Hace 12 minutos</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Alerta: Stock bajo en Papel Bond</p>
                  <p className="text-xs text-muted-foreground">Hace 1 hora</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Tareas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Arqueo de caja pendiente</p>
                  <p className="text-xs text-muted-foreground">Vence hoy</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Conciliación bancaria</p>
                  <p className="text-xs text-muted-foreground">Vence mañana</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Reporte de inventario mensual</p>
                  <p className="text-xs text-muted-foreground">Vence en 3 días</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderMainDashboard();
      case 'cash-banks':
        return hasCashierAccess ? <CashBanksDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case 'receipts':
        return hasCashierAccess ? <ReceiptsDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case 'inventory':
        return hasWarehouseAccess ? <InventoryDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case 'logistics':
        return hasLogisticsAccess ? <LogisticsDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case 'hr':
        return hasHRAccess ? <HRDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      default:
        return renderMainDashboard();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tesorería y Administración</h1>
        <p className="text-gray-600 mt-2">
          Sistema integral de gestión financiera y administrativa - {user?.role === 'FINANCE_ADMIN' ? 'Administrador' : user?.role === 'CASHIER' ? 'Cajero/a' : user?.role === 'WAREHOUSE' ? 'Almacén' : user?.role === 'LOGISTICS' ? 'Logística' : user?.role === 'HR_ADMIN' ? 'RRHH' : 'Usuario'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          
          {hasCashierAccess && (
            <TabsTrigger value="cash-banks" className="flex items-center space-x-2">
              <Banknote className="h-4 w-4" />
              <span>Caja y Bancos</span>
            </TabsTrigger>
          )}
          
          {hasCashierAccess && (
            <TabsTrigger value="receipts" className="flex items-center space-x-2">
              <Receipt className="h-4 w-4" />
              <span>Boletas</span>
            </TabsTrigger>
          )}
          
          {hasWarehouseAccess && (
            <TabsTrigger value="inventory" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Inventario</span>
            </TabsTrigger>
          )}
          
          {hasLogisticsAccess && (
            <TabsTrigger value="logistics" className="flex items-center space-x-2">
              <Truck className="h-4 w-4" />
              <span>Logística</span>
            </TabsTrigger>
          )}
          
          {hasHRAccess && (
            <TabsTrigger value="hr" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>RRHH</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {renderTabContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceModule;