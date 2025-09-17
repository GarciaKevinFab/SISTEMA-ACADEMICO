import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import CashBanksDashboard from "../../components/finance/CashBanksDashboard";
import ReceiptsDashboard from "../../components/finance/ReceiptsDashboard";
import InventoryDashboard from "../../components/finance/InventoryDashboard";
import LogisticsDashboard from "../../components/finance/LogisticsDashboard";
import HRDashboard from "../../components/finance/HRDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Banknote, Receipt, Package, Truck, Users, BarChart3, AlertTriangle, TrendingUp, FileText, Coins } from "lucide-react";
import { toast } from "sonner";
import ConceptsCatalog from "./ConceptsCatalog";
import ReconciliationDashboard from "./ReconciliationDashboard";
import StudentAccountsDashboard from "./StudentAccountsDashboard";
import FinanceReports from "./FinanceReports";
import { fmtCurrency, formatApiError } from "../../utils/format";
import { PERMS } from "../../auth/permissions";

const FinanceModule = () => {
  const { user, api, hasPerm, hasAny } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(true);

  // ------- Permisos por funcionalidad (no por rol) -------
  const canCashBanks = hasAny([PERMS["fin.cashbanks.view"]]);           // Caja y bancos + boletas
  const canReceipts = hasAny([PERMS["fin.cashbanks.view"]]);           // Reutilizo la misma vista
  const canStdAccounts = hasAny([PERMS["fin.student.accounts.view"]]);    // Estados de cuenta
  const canConcepts = hasAny([PERMS["fin.concepts.manage"]]);          // Catálogo de conceptos
  const canReconcile = hasAny([PERMS["fin.reconciliation.view"]]);      // Conciliación
  const canReports = hasAny([PERMS["fin.reports.view"]]);             // Reportes fin.
  const canInventory = hasAny([PERMS["fin.inventory.view"]]);           // Inventario (adm.)
  const canLogistics = hasAny([PERMS["fin.logistics.view"]]);           // Logística (adm.)
  const canHR = hasAny([PERMS["hr.view"]]);                      // RRHH (adm.)

  // etiqueta visible según el permiso principal del usuario (solo estética)
  const roleLabel = (() => {
    if (hasAny([PERMS["fin.concepts.manage"], PERMS["fin.reports.view"], PERMS["fin.reconciliation.view"]])) return "Administrador Financiero";
    if (canCashBanks || canReceipts || canStdAccounts) return "Caja";
    if (canInventory) return "Almacén";
    if (canLogistics) return "Logística";
    if (canHR) return "RR.HH.";
    return "Usuario";
  })();

  const fetchDashboardStats = useCallback(async () => {
    let alive = true;
    try {
      setLoading(true);
      const { data } = await api.get("/dashboard/stats");
      if (alive) setDashboardStats(data?.stats ?? data ?? {});
    } catch (error) {
      if (alive) toast.error(formatApiError(error, "No se pudieron cargar las estadísticas"));
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
  }, [api]);

  useEffect(() => {
    let cleanup;
    (async () => { cleanup = await fetchDashboardStats(); })();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [fetchDashboardStats]);

  const renderMainDashboard = () => {
    const cashToday = dashboardStats?.cash_today_amount;
    const monthlyIncome = dashboardStats?.monthly_income_amount;
    const monthlyDelta = dashboardStats?.monthly_income_change_pct;
    const lowStockAlerts = dashboardStats?.low_stock_alerts;
    const activeEmployees = dashboardStats?.active_employees;

    return (
      <div className="space-y-6">
        {/* tarjetas top, cada una condicionada por permiso */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {canCashBanks && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Caja del día</CardTitle>
                <Banknote className="h-4 w-4 text-green-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{fmtCurrency(cashToday ?? 0)}</div>
                <p className="text-xs text-muted-foreground">Sesión actual abierta</p>
              </CardContent>
            </Card>
          )}

          {canReports && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{fmtCurrency(monthlyIncome ?? 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {typeof monthlyDelta === "number" ? `${monthlyDelta > 0 ? "+" : ""}${monthlyDelta}% vs. mes anterior` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          {canInventory && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertas de stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {Number.isFinite(lowStockAlerts) ? lowStockAlerts : 0}
                </div>
                <p className="text-xs text-muted-foreground">Ítems con stock bajo</p>
              </CardContent>
            </Card>
          )}

          {canHR && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Personal activo</CardTitle>
                <Users className="h-4 w-4 text-purple-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {Number.isFinite(activeEmployees) ? activeEmployees : 0}
                </div>
                <p className="text-xs text-muted-foreground">Empleados registrados</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Acciones rápidas según permisos */}
        <Card aria-busy={loading}>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Accede a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {canCashBanks && (
                <Button onClick={() => setActiveTab("cash-banks")} className="h-20 flex flex-col items-center justify-center space-y-2" variant="outline">
                  <Banknote className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Caja y Bancos</span>
                </Button>
              )}
              {canReceipts && (
                <Button onClick={() => setActiveTab("receipts")} className="h-20 flex flex-col items-center justify-center space-y-2" variant="outline">
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Boletas</span>
                </Button>
              )}
              {canInventory && (
                <Button onClick={() => setActiveTab("inventory")} className="h-20 flex flex-col items-center justify-center space-y-2" variant="outline">
                  <Package className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Inventario</span>
                </Button>
              )}
              {canLogistics && (
                <Button onClick={() => setActiveTab("logistics")} className="h-20 flex flex-col items-center justify-center space-y-2" variant="outline">
                  <Truck className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Logística</span>
                </Button>
              )}
              {canHR && (
                <Button onClick={() => setActiveTab("hr")} className="h-20 flex flex-col items-center justify-center space-y-2" variant="outline">
                  <Users className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">RRHH</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* demo de actividades / tareas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Actividades recientes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {canReceipts && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Boleta REC-001-000125 pagada</p>
                      <p className="text-xs text-muted-foreground">Hace 5 minutos</p>
                    </div>
                  </div>
                )}
                {canInventory && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Movimiento de inventario: Entrada</p>
                      <p className="text-xs text-muted-foreground">Hace 12 minutos</p>
                    </div>
                  </div>
                )}
                {canInventory && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Alerta: Stock bajo en Papel Bond</p>
                      <p className="text-xs text-muted-foreground">Hace 1 hora</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Próximas tareas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {canCashBanks && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Arqueo de caja pendiente</p>
                      <p className="text-xs text-muted-foreground">Vence hoy</p>
                    </div>
                  </div>
                )}
                {canReconcile && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Conciliación bancaria</p>
                      <p className="text-xs text-muted-foreground">Vence mañana</p>
                    </div>
                  </div>
                )}
                {canReports && (
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Reporte de inventario mensual</p>
                      <p className="text-xs text-muted-foreground">Vence en 3 días</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": return renderMainDashboard();
      case "cash-banks": return canCashBanks ? <CashBanksDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case "receipts": return canReceipts ? <ReceiptsDashboard /> : <div className="text-center py-8">No tienes permisos para acceder a esta sección</div>;
      case "student-accounts": return canStdAccounts ? <StudentAccountsDashboard /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "concepts": return canConcepts ? <ConceptsCatalog /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "reconciliation": return canReconcile ? <ReconciliationDashboard /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "reports": return canReports ? <FinanceReports /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "inventory": return canInventory ? <InventoryDashboard /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "logistics": return canLogistics ? <LogisticsDashboard /> : <div className="text-center py-8">No tienes permisos…</div>;
      case "hr": return canHR ? <HRDashboard /> : <div className="text-center py-8">No tienes permisos…</div>;
      default: return renderMainDashboard();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return <div className="text-center py-12">Acceso no autorizado</div>;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tesorería y Administración</h1>
        <p className="text-gray-600 mt-2">Sistema integral — {roleLabel}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>Dashboard</span>
          </TabsTrigger>

          {canCashBanks && (
            <>
              <TabsTrigger value="cash-banks" className="flex items-center space-x-2">
                <Banknote className="h-4 w-4" aria-hidden="true" />
                <span>Caja y Bancos</span>
              </TabsTrigger>
              <TabsTrigger value="receipts" className="flex items-center space-x-2">
                <Receipt className="h-4 w-4" aria-hidden="true" />
                <span>Boletas</span>
              </TabsTrigger>
            </>
          )}

          {canStdAccounts && (
            <TabsTrigger value="student-accounts" className="flex items-center space-x-2">
              <Coins className="h-4 w-4" aria-hidden="true" />
              <span>Estados de Cuenta</span>
            </TabsTrigger>
          )}

          {canConcepts && (
            <TabsTrigger value="concepts" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>Conceptos</span>
            </TabsTrigger>
          )}

          {canReconcile && (
            <TabsTrigger value="reconciliation" className="flex items-center space-x-2">
              <Banknote className="h-4 w-4" aria-hidden="true" />
              <span>Conciliación</span>
            </TabsTrigger>
          )}

          {canReports && (
            <TabsTrigger value="reports" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>Reportes</span>
            </TabsTrigger>
          )}

          {canInventory && (
            <TabsTrigger value="inventory" className="flex items-center space-x-2">
              <Package className="h-4 w-4" aria-hidden="true" />
              <span>Inventario</span>
            </TabsTrigger>
          )}

          {canLogistics && (
            <TabsTrigger value="logistics" className="flex items-center space-x-2">
              <Truck className="h-4 w-4" aria-hidden="true" />
              <span>Logística</span>
            </TabsTrigger>
          )}

          {canHR && (
            <TabsTrigger value="hr" className="flex items-center space-x-2">
              <Users className="h-4 w-4" aria-hidden="true" />
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
