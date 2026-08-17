// src/modules/finance/FinanceModule.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import CashBanksDashboard from "../../components/finance/CashBanksDashboard";
import ReceiptsDashboard from "../../components/finance/ReceiptsDashboard";
import InventoryDashboard from "../../components/finance/InventoryDashboard";
import HRDashboard from "../../components/finance/HRDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TabsContent } from "../../components/ui/tabs";
import { Banknote, Receipt, Package, Users, BarChart3, AlertTriangle, TrendingUp, FileText, Coins, Wallet } from "lucide-react";
import { toast } from "../../utils/safeToast";
import ConceptsCatalog from "./ConceptsCatalog";
import ReconciliationDashboard from "./ReconciliationDashboard";
import StudentAccountsDashboard from "./StudentAccountsDashboard";
import FinanceReports from "./FinanceReports";
import { fmtCurrency, formatApiError } from "../../utils/format";
import { PERMS } from "../../auth/permissions";
import EnrollmentPaymentsReview from "./EnrollmentPaymentsReview";
import AdmissionPaymentsReview from "./AdmissionPaymentsReview";
import ModuleShell from "@/components/module/ModuleShell";

// ---- Helper seguro para toasts de error ----
const showApiError = (e, fallbackMsg) => {
  const err = formatApiError(e, fallbackMsg);
  if (typeof err === "string") toast.error(err);
  else toast.error(err.title ?? (fallbackMsg || "Error"), { description: err.description });
};

const GROUPS = {
  inicio: null,
  gestion: "Gestión",
  pagos: "Pagos de procesos",
  control: "Reportes y control",
  areas: "Otras áreas",
};

const FinanceModule = () => {
  const { user, api, hasAny } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(true);

  // ------- Permisos por funcionalidad -------
  const canCashBanks = hasAny([PERMS["fin.cashbanks.view"]]);
  const canReceipts = hasAny([PERMS["fin.cashbanks.view"]]);
  const canStdAccounts = hasAny([PERMS["fin.student.accounts.view"]]);
  const canConcepts = hasAny([PERMS["fin.concepts.manage"]]);
  const canReconcile = hasAny([PERMS["fin.reconciliation.view"]]);
  const canReports = hasAny([PERMS["fin.reports.view"]]);
  const canInventory = hasAny([PERMS["fin.inventory.view"]]); // Ahora este permiso cubre Logística e Inventario
  const canHR = hasAny([PERMS["hr.view"]]);
  const canEnrollmentPayments = hasAny([PERMS["enrollment.payment.review"], PERMS["enrollment.payment.approve"]]);
  const canAdmissionPayments = hasAny([PERMS["enrollment.payment.review"], PERMS["enrollment.payment.approve"]]);

  const roleLabel = (() => {
    if (hasAny([PERMS["fin.concepts.manage"], PERMS["fin.reports.view"], PERMS["fin.reconciliation.view"]])) return "Administrador Financiero";
    if (canCashBanks || canReceipts || canStdAccounts) return "Caja";
    if (canInventory) return "Logística y Almacén"; // Actualizado
    if (canHR) return "RR.HH.";
    return "Usuario";
  })();

  // ------- Pestañas para la cáscara compartida -------
  const tabs = [
    { key: "dashboard", label: "Dashboard", Icon: BarChart3, group: "inicio" },
    ...(canCashBanks ? [{ key: "cash-banks", label: "Caja y Bancos", Icon: Banknote, group: "gestion" }] : []),
    ...(canReceipts ? [{ key: "receipts", label: "Boletas", Icon: Receipt, group: "gestion" }] : []),
    ...(canStdAccounts ? [{ key: "student-accounts", label: "Estados de Cuenta", Icon: Coins, group: "gestion" }] : []),
    ...(canConcepts ? [{ key: "concepts", label: "Conceptos", Icon: FileText, group: "gestion" }] : []),
    ...(canEnrollmentPayments ? [{ key: "enrollment-payments", label: "Pagos Matrícula", Icon: Receipt, group: "pagos" }] : []),
    ...(canAdmissionPayments ? [{ key: "admission-payments", label: "Pagos Admisión", Icon: FileText, group: "pagos" }] : []),
    ...(canReconcile ? [{ key: "reconciliation", label: "Conciliación", Icon: Banknote, group: "control" }] : []),
    ...(canReports ? [{ key: "reports", label: "Reportes", Icon: BarChart3, group: "control" }] : []),
    ...(canInventory ? [{ key: "inventory", label: "Logística e Inv.", Icon: Package, group: "areas" }] : []),
    ...(canHR ? [{ key: "hr", label: "RRHH", Icon: Users, group: "areas" }] : []),
  ];

  const fetchDashboardStats = useCallback(async (signal) => {
    try {
      setLoading(true);
      const { data } = await api.get("/finance/dashboard/stats", { signal });
      setDashboardStats(data?.stats ?? data ?? {});
    } catch (error) {
      if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") return;
      showApiError(error, "No se pudieron cargar las estadísticas");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardStats(controller.signal);
    return () => controller.abort();
  }, [fetchDashboardStats]);


  const renderMainDashboard = () => {
    const cashToday = dashboardStats?.cash_today_amount;
    const monthlyIncome = dashboardStats?.monthly_income_amount;
    const monthlyDelta = dashboardStats?.monthly_income_change_pct;
    const lowStockAlerts = dashboardStats?.low_stock_alerts;
    const activeEmployees = dashboardStats?.active_employees;

    return (
      <div className="space-y-6 pb-24 sm:pb-6">

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
                <div className="text-2xl font-bold text-orange-600">{Number.isFinite(lowStockAlerts) ? lowStockAlerts : 0}</div>
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
                <div className="text-2xl font-bold text-purple-600">{Number.isFinite(activeEmployees) ? activeEmployees : 0}</div>
                <p className="text-xs text-muted-foreground">Empleados registrados</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card aria-busy={loading}>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Accede a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {canCashBanks && (
                <Button
                  onClick={() => setActiveTab("cash-banks")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Banknote className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Caja y Bancos</span>
                </Button>
              )}
              {canReceipts && (
                <Button
                  onClick={() => setActiveTab("receipts")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Boletas</span>
                </Button>
              )}
              {canInventory && (
                <Button
                  onClick={() => setActiveTab("inventory")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Package className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Logística e Inv.</span>
                </Button>
              )}
              {canHR && (
                <Button
                  onClick={() => setActiveTab("hr")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Users className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">RRHH</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
    <ModuleShell
      icon={Wallet}
      title="Módulo de Finanzas"
      subtitle="Pagos, deudas y control de caja"
      accent="linear-gradient(135deg, #10B981, #047857)"
      tabs={tabs}
      groupLabels={GROUPS}
      tab={activeTab}
      onTab={setActiveTab}
    >
      <TabsContent value="dashboard">{renderMainDashboard()}</TabsContent>
      <TabsContent value="cash-banks">
        {canCashBanks ? <CashBanksDashboard /> : <div className="text-center py-8">No tienes permisos</div>}
      </TabsContent>
      <TabsContent value="receipts">
        {canReceipts ? <ReceiptsDashboard /> : <div className="text-center py-8">No tienes permisos</div>}
      </TabsContent>
      <TabsContent value="student-accounts">
        {canStdAccounts ? <StudentAccountsDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="concepts">
        {canConcepts ? <ConceptsCatalog /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="reconciliation">
        {canReconcile ? <ReconciliationDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="reports">
        {canReports ? <FinanceReports /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="inventory">
        {canInventory ? <InventoryDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="hr">
        {canHR ? <HRDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="enrollment-payments">
        {canEnrollmentPayments ? <EnrollmentPaymentsReview /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
      <TabsContent value="admission-payments">
        {canAdmissionPayments ? <AdmissionPaymentsReview /> : <div className="text-center py-8">No tienes permisos…</div>}
      </TabsContent>
    </ModuleShell>
  );
};

export default FinanceModule;
