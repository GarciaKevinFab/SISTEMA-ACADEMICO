import React, { useEffect, useMemo, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { Plus, Building, FileText, Package, Download, Eye, Send, XCircle, CheckCircle, Ban } from "lucide-react";

import { Logistics, Inventory } from "../../services/finance.service";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => n(v).toFixed(2);

// helper DRF/Axios
const getErrMsg = (e, fallback = "Ocurrió un error") => {
  const msg =
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    (typeof e?.response?.data === "string" ? e.response.data : null) ||
    e?.message;
  return msg || fallback;
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const LogisticsDashboard = () => {
  const { user } = useContext(AuthContext);

  const isAdmin =
    !!user?.is_staff || !!user?.is_superuser || String(user?.role || "").toUpperCase() === "ADMIN";

  const [suppliers, setSuppliers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [loading, setLoading] = useState(true);

  const [openDialogs, setOpenDialogs] = useState({
    newSupplier: false,
    newRequirement: false,
    viewRequirement: false,
  });

  // OC dialogs
  const [openPO, setOpenPO] = useState(false);
  const [openViewPO, setOpenViewPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  const [poForm, setPoForm] = useState({
    requirement_id: "",
    supplier_id: "",
    expected_date: "",
    note: "",
  });

  const [newSupplier, setNewSupplier] = useState({
    ruc: "",
    company_name: "",
    trade_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    bank_account: "",
    bank_name: "",
  });

  const [newRequirement, setNewRequirement] = useState({
    title: "",
    description: "",
    justification: "",
    required_date: "",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "",
    unit_of_measure: "UNIT",
    estimated_unit_price: "",
    technical_specifications: "",
  });

  const [selectedRequirement, setSelectedRequirement] = useState(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState(null);

  const requirementStatuses = useMemo(
    () => ({
      DRAFT: { label: "Borrador", color: "bg-gray-500" },
      SUBMITTED: { label: "Enviado", color: "bg-blue-500" },
      APPROVED: { label: "Aprobado", color: "bg-green-500" },
      REJECTED: { label: "Rechazado", color: "bg-red-500" },
      CONVERTED_TO_PO: { label: "Convertido a OC", color: "bg-purple-500" },
    }),
    []
  );

  const supplierStatuses = useMemo(
    () => ({
      ACTIVE: { label: "Activo", color: "bg-green-500" },
      INACTIVE: { label: "Inactivo", color: "bg-gray-500" },
      BLACKLISTED: { label: "Lista Negra", color: "bg-red-500" },
    }),
    []
  );

  const poStatuses = useMemo(
    () => ({
      DRAFT: { label: "Borrador", color: "bg-gray-500" },
      SENT: { label: "Enviada", color: "bg-blue-500" },
      RECEIVED: { label: "Recibida", color: "bg-green-500" },
      CANCELLED: { label: "Anulada", color: "bg-red-500" },
    }),
    []
  );

  const unitOfMeasures = useMemo(
    () => ({
      UNIT: "Unidad",
      DOZEN: "Docena",
      KG: "Kilogramo",
      L: "Litro",
      M: "Metro",
      PKG: "Paquete",
      BOX: "Caja",
    }),
    []
  );

  const approvedReqOptions = useMemo(
    () => requirements.filter((r) => r.status === "APPROVED"),
    [requirements]
  );

  const activeSupplierOptions = useMemo(
    () => suppliers.filter((s) => s.status === "ACTIVE"),
    [suppliers]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [supRes, reqRes, invRes, poRes] = await Promise.all([
        Logistics.suppliers(),
        Logistics.requirements(),
        Inventory.items(),
        Logistics.purchaseOrders(),
      ]);

      setSuppliers(supRes.suppliers || supRes.items || supRes || []);
      setRequirements(reqRes.requirements || reqRes.items || reqRes || []);
      setInventoryItems(invRes.items || invRes || []);
      setPurchaseOrders(poRes.purchase_orders || poRes.items || poRes || []);
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo cargar logística") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ✅ RUC PERÚ correcto
  const validateRUC = (ruc) => {
    if (!ruc || !/^\d{11}$/.test(ruc)) return false;

    const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(ruc[i]) * factors[i];

    const remainder = sum % 11;
    let check = 11 - remainder;
    if (check === 10) check = 0;
    if (check === 11) check = 1;

    return check === Number(ruc[10]);
  };

  const createSupplier = async () => {
    if (!validateRUC(newSupplier.ruc)) {
      toast.error("Error", { description: "El RUC ingresado no es válido" });
      return;
    }

    try {
      const data = await Logistics.createSupplier(newSupplier);

      toast.success("Éxito", {
        description: `Proveedor ${data?.supplier?.supplier_code || ""} creado correctamente`,
      });

      setOpenDialogs((p) => ({ ...p, newSupplier: false }));
      setNewSupplier({
        ruc: "",
        company_name: "",
        trade_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        bank_account: "",
        bank_name: "",
      });

      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo crear el proveedor") });
    }
  };

  const addItemToRequirement = () => {
    if (!newItem.description || !newItem.quantity) {
      toast.error("Error", { description: "Complete la descripción y cantidad del item" });
      return;
    }

    const qty = parseInt(newItem.quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Error", { description: "La cantidad debe ser mayor a 0" });
      return;
    }

    const item = {
      ...newItem,
      quantity: qty,
      estimated_unit_price: n(newItem.estimated_unit_price),
    };

    setNewRequirement((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      description: "",
      quantity: "",
      unit_of_measure: "UNIT",
      estimated_unit_price: "",
      technical_specifications: "",
    });
  };

  const removeItemFromRequirement = (index) => {
    setNewRequirement((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const createRequirement = async () => {
    if (!newRequirement.title || !newRequirement.justification || newRequirement.items.length === 0) {
      toast.error("Error", { description: "Complete todos los campos obligatorios" });
      return;
    }

    try {
      const payload = {
        ...newRequirement,
        required_date: newRequirement.required_date || null,
        items: newRequirement.items.map((it) => ({
          ...it,
          quantity: parseInt(it.quantity, 10),
          estimated_unit_price: n(it.estimated_unit_price),
        })),
      };

      const data = await Logistics.createRequirement(payload);

      toast.success("Éxito", {
        description: `Requerimiento ${data?.requirement?.requirement_number || ""} creado correctamente`,
      });

      setOpenDialogs((p) => ({ ...p, newRequirement: false }));
      setNewRequirement({
        title: "",
        description: "",
        justification: "",
        required_date: "",
        items: [],
      });

      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo crear el requerimiento") });
    }
  };

  const viewRequirement = async (req) => {
    try {
      const data = await Logistics.requirement(req.id);
      setSelectedRequirement(data.requirement || data || req);
      setOpenDialogs((p) => ({ ...p, viewRequirement: true }));
    } catch {
      setSelectedRequirement(req);
      setOpenDialogs((p) => ({ ...p, viewRequirement: true }));
    }
  };

  // ======================
  // Estados Requerimiento
  // ======================

  const submitRequirement = async (id) => {
    try {
      await Logistics.submitRequirement(id);
      toast.success("Requerimiento enviado");
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo enviar el requerimiento") });
    }
  };

  const approveRequirement = async (id) => {
    try {
      await Logistics.approveRequirement(id);
      toast.success("Requerimiento aprobado");
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo aprobar") });
    }
  };

  const openReject = (id) => {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const rejectRequirement = async () => {
    if (!rejectTargetId) return;
    try {
      await Logistics.rejectRequirement(rejectTargetId, { reason: rejectReason || "" });
      toast.success("Requerimiento rechazado");
      setRejectDialogOpen(false);
      setRejectTargetId(null);
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo rechazar") });
    }
  };

  // ======================
  // Órdenes de compra (OC)
  // ======================

  const createPO = async () => {
    if (!poForm.requirement_id || !poForm.supplier_id) {
      toast.error("Error", { description: "Selecciona requerimiento y proveedor" });
      return;
    }

    try {
      const res = await Logistics.createPurchaseOrder({
        requirement_id: Number(poForm.requirement_id),
        supplier_id: Number(poForm.supplier_id),
        expected_date: poForm.expected_date || null,
        note: poForm.note || "",
      });

      toast.success("Éxito", { description: `OC ${res?.purchase_order?.order_number || ""} creada` });

      setOpenPO(false);
      setPoForm({ requirement_id: "", supplier_id: "", expected_date: "", note: "" });

      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo crear la OC") });
    }
  };

  const viewPO = async (po) => {
    try {
      const res = await Logistics.purchaseOrder(po.id);
      setSelectedPO(res.purchase_order || res || po);
    } catch {
      setSelectedPO(po);
    } finally {
      setOpenViewPO(true);
    }
  };

  const sendPO = async (id) => {
    try {
      await Logistics.sendPurchaseOrder(id);
      toast.success("OC enviada");
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo enviar la OC") });
    }
  };

  const receivePO = async (id) => {
    try {
      await Logistics.receivePurchaseOrder(id);
      toast.success("OC recibida");
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo recibir la OC") });
    }
  };

  const cancelPO = async (id) => {
    try {
      await Logistics.cancelPurchaseOrder(id);
      toast.success("OC anulada");
      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo anular la OC") });
    }
  };

  // ======================
  // Exportaciones
  // ======================

  const exportRequirementPdf = async (id, number = "requerimiento") => {
    try {
      const res = await Logistics.requirementPdf(id);
      downloadBlob(res.data, `${number}.pdf`);
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo exportar PDF") });
    }
  };

  const exportPoPdf = async (id, orderNumber = "orden-compra") => {
    try {
      const res = await Logistics.purchaseOrderPdf(id);
      downloadBlob(res.data, `${orderNumber}.pdf`);
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo exportar PDF") });
    }
  };

  const exportSuppliersCsv = async () => {
    try {
      const res = await Logistics.suppliersCsv();
      downloadBlob(res.data, `proveedores.csv`);
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo descargar CSV") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const activeSuppliers = suppliers.filter((s) => s.status === "ACTIVE").length;
  const pendingReqs = requirements.filter((r) => ["DRAFT", "SUBMITTED"].includes(r.status)).length;
  const approvedReqs = requirements.filter((r) => r.status === "APPROVED").length;
  const totalEstimated = money(requirements.reduce((sum, r) => sum + n(r.estimated_total), 0));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeSuppliers}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requerimientos Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingReqs}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requerimientos Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedReqs}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">S/. {totalEstimated}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requerimientos</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="purchase-orders">Órdenes de Compra</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* REQUIREMENTS */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Requerimientos</CardTitle>
                <CardDescription>Solicitudes de compra y adquisiciones</CardDescription>
              </div>

              <Dialog
                open={openDialogs.newRequirement}
                onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, newRequirement: open }))}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Requerimiento
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Crear Requerimiento</DialogTitle>
                    <DialogDescription>Complete los datos del requerimiento de compra</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        value={newRequirement.title}
                        onChange={(e) => setNewRequirement((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Compra de materiales de oficina"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={newRequirement.description}
                        onChange={(e) => setNewRequirement((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Descripción detallada del requerimiento"
                      />
                    </div>

                    <div>
                      <Label htmlFor="justification">Justificación *</Label>
                      <Textarea
                        id="justification"
                        value={newRequirement.justification}
                        onChange={(e) => setNewRequirement((p) => ({ ...p, justification: e.target.value }))}
                        placeholder="Justificación de la compra"
                      />
                    </div>

                    <div>
                      <Label htmlFor="required_date">Fecha Requerida</Label>
                      <Input
                        id="required_date"
                        type="date"
                        value={newRequirement.required_date}
                        onChange={(e) => setNewRequirement((p) => ({ ...p, required_date: e.target.value }))}
                      />
                    </div>

                    {/* Items */}
                    <div>
                      <Label>Items del Requerimiento *</Label>

                      <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label>Descripción</Label>
                            <Input
                              value={newItem.description}
                              onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                              placeholder="Papel Bond A4"
                            />
                          </div>

                          <div>
                            <Label>Cantidad</Label>
                            <Input
                              type="number"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))}
                              placeholder="100"
                            />
                          </div>

                          <div>
                            <Label>Unidad de Medida</Label>
                            <Select
                              value={newItem.unit_of_measure}
                              onValueChange={(value) => setNewItem((p) => ({ ...p, unit_of_measure: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(unitOfMeasures).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Precio Estimado</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newItem.estimated_unit_price}
                              onChange={(e) => setNewItem((p) => ({ ...p, estimated_unit_price: e.target.value }))}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <Label>Especificaciones Técnicas</Label>
                          <Textarea
                            value={newItem.technical_specifications}
                            onChange={(e) => setNewItem((p) => ({ ...p, technical_specifications: e.target.value }))}
                            placeholder="Especificaciones técnicas del producto"
                          />
                        </div>

                        <Button type="button" onClick={addItemToRequirement} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Item
                        </Button>
                      </div>

                      {newRequirement.items.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Items agregados:</h4>

                          <div className="space-y-2">
                            {newRequirement.items.map((it, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                <div>
                                  <p className="font-medium">{it.description}</p>
                                  <p className="text-sm text-gray-600">
                                    Cantidad: {it.quantity} {unitOfMeasures[it.unit_of_measure]} - S/.{" "}
                                    {money(it.estimated_unit_price)} c/u
                                  </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => removeItemFromRequirement(index)}>
                                  Eliminar
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="font-semibold text-blue-800">
                              Total Estimado: S/.{" "}
                              {money(newRequirement.items.reduce((sum, it) => sum + n(it.quantity) * n(it.estimated_unit_price), 0))}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={createRequirement}
                      disabled={!newRequirement.title || !newRequirement.justification || newRequirement.items.length === 0}
                    >
                      Crear Requerimiento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {requirements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay requerimientos registrados</div>
                ) : (
                  requirements.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{req.title}</p>
                          <p className="text-sm text-gray-600">{req.requirement_number}</p>
                          <p className="text-xs text-gray-500">Solicitado por: {req.requester?.username || "Usuario"}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-semibold">S/. {money(req.estimated_total)}</p>
                          <p className="text-xs text-gray-500">
                            {req.required_date ? new Date(req.required_date).toLocaleDateString() : "Sin fecha"}
                          </p>
                        </div>

                        <Badge className={`${requirementStatuses[req.status]?.color || "bg-gray-500"} text-white`}>
                          {requirementStatuses[req.status]?.label || req.status}
                        </Badge>

                        <Button size="sm" variant="outline" onClick={() => viewRequirement(req)}>
                          <Eye className="h-4 w-4" />
                        </Button>

                        {req.status === "DRAFT" && (
                          <Button size="sm" onClick={() => submitRequirement(req.id)}>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </Button>
                        )}

                        {req.status === "SUBMITTED" && isAdmin && (
                          <>
                            <Button size="sm" onClick={() => approveRequirement(req.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Aprobar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openReject(req.id)}>
                              <Ban className="h-4 w-4 mr-2" />
                              Rechazar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Proveedores</CardTitle>
                <CardDescription>Registro y evaluación de proveedores</CardDescription>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={exportSuppliersCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar CSV
                </Button>

                <Dialog
                  open={openDialogs.newSupplier}
                  onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, newSupplier: open }))}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Proveedor
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Proveedor</DialogTitle>
                      <DialogDescription>Complete los datos del nuevo proveedor</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <Label>RUC *</Label>
                        <Input
                          value={newSupplier.ruc}
                          onChange={(e) => setNewSupplier((p) => ({ ...p, ruc: e.target.value }))}
                          placeholder="20123456789"
                          maxLength={11}
                        />
                      </div>

                      <div>
                        <Label>Razón Social *</Label>
                        <Input
                          value={newSupplier.company_name}
                          onChange={(e) => setNewSupplier((p) => ({ ...p, company_name: e.target.value }))}
                          placeholder="Empresa S.A.C."
                        />
                      </div>

                      <div>
                        <Label>Nombre Comercial</Label>
                        <Input
                          value={newSupplier.trade_name}
                          onChange={(e) => setNewSupplier((p) => ({ ...p, trade_name: e.target.value }))}
                          placeholder="Nombre comercial"
                        />
                      </div>

                      <div>
                        <Label>Persona de Contacto</Label>
                        <Input
                          value={newSupplier.contact_person}
                          onChange={(e) => setNewSupplier((p) => ({ ...p, contact_person: e.target.value }))}
                          placeholder="Juan Pérez"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newSupplier.email}
                            onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))}
                            placeholder="contacto@empresa.com"
                          />
                        </div>
                        <div>
                          <Label>Teléfono</Label>
                          <Input
                            value={newSupplier.phone}
                            onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="987654321"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Dirección</Label>
                        <Textarea
                          value={newSupplier.address}
                          onChange={(e) => setNewSupplier((p) => ({ ...p, address: e.target.value }))}
                          placeholder="Dirección completa"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Banco</Label>
                          <Input
                            value={newSupplier.bank_name}
                            onChange={(e) => setNewSupplier((p) => ({ ...p, bank_name: e.target.value }))}
                            placeholder="BCP"
                          />
                        </div>
                        <div>
                          <Label>Cuenta Bancaria</Label>
                          <Input
                            value={newSupplier.bank_account}
                            onChange={(e) => setNewSupplier((p) => ({ ...p, bank_account: e.target.value }))}
                            placeholder="19123456789012345678"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button onClick={createSupplier} disabled={!newSupplier.ruc || !newSupplier.company_name}>
                        Crear Proveedor
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {suppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay proveedores registrados</div>
                ) : (
                  suppliers.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <Building className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{s.company_name}</p>
                          <p className="text-sm text-gray-600">RUC: {s.ruc}</p>
                          <p className="text-xs text-gray-500">{s.contact_person}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Código: {s.supplier_code}</p>
                          <p className="text-xs text-gray-500">
                            Órdenes: {n(s.total_orders)} | Completadas: {n(s.completed_orders)}
                          </p>
                        </div>

                        <Badge className={`${supplierStatuses[s.status]?.color || "bg-gray-500"} text-white`}>
                          {supplierStatuses[s.status]?.label || s.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PURCHASE ORDERS */}
        <TabsContent value="purchase-orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Órdenes de Compra</CardTitle>
                <CardDescription>Crear desde requerimientos aprobados y dar seguimiento</CardDescription>
              </div>

              <Dialog open={openPO} onOpenChange={setOpenPO}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva OC
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Crear Orden de Compra</DialogTitle>
                    <DialogDescription>Se crea desde un requerimiento en estado APPROVED</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>Requerimiento (APPROVED) *</Label>
                      <Select
                        value={poForm.requirement_id}
                        onValueChange={(v) => setPoForm((p) => ({ ...p, requirement_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona requerimiento" />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedReqOptions.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No hay requerimientos aprobados
                            </SelectItem>
                          ) : (
                            approvedReqOptions.map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>
                                {r.requirement_number} - {r.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Proveedor (ACTIVE) *</Label>
                      <Select
                        value={poForm.supplier_id}
                        onValueChange={(v) => setPoForm((p) => ({ ...p, supplier_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeSupplierOptions.length === 0 ? (
                            <SelectItem value="__none2" disabled>
                              No hay proveedores activos
                            </SelectItem>
                          ) : (
                            activeSupplierOptions.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.supplier_code} - {s.company_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Fecha esperada</Label>
                      <Input
                        type="date"
                        value={poForm.expected_date}
                        onChange={(e) => setPoForm((p) => ({ ...p, expected_date: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label>Nota</Label>
                      <Textarea
                        value={poForm.note}
                        onChange={(e) => setPoForm((p) => ({ ...p, note: e.target.value }))}
                        placeholder="Observaciones..."
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={createPO} disabled={!poForm.requirement_id || !poForm.supplier_id}>
                      Crear OC
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {purchaseOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay órdenes de compra</div>
                ) : (
                  purchaseOrders.map((po) => (
                    <div key={po.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <Package className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="font-semibold">{po.order_number}</p>
                          <p className="text-sm text-gray-600">
                            Req: {po.requirement_number} — {po.requirement_title}
                          </p>
                          <p className="text-xs text-gray-500">
                            Proveedor: {po.supplier_name} (RUC {po.supplier_ruc})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-semibold">S/. {money(po.total)}</p>
                          <p className="text-xs text-gray-500">
                            {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "Sin fecha"}
                          </p>
                        </div>

                        <Badge className={`${poStatuses[po.status]?.color || "bg-gray-500"} text-white`}>
                          {poStatuses[po.status]?.label || po.status}
                        </Badge>

                        <Button size="sm" variant="outline" onClick={() => viewPO(po)}>
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => exportPoPdf(po.id, po.order_number)}>
                          <Download className="h-4 w-4" />
                        </Button>

                        {po.status === "DRAFT" && (
                          <Button size="sm" onClick={() => sendPO(po.id)}>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </Button>
                        )}

                        {(po.status === "SENT" || po.status === "DRAFT") && (
                          <Button size="sm" variant="outline" onClick={() => receivePO(po.id)}>
                            Recibir
                          </Button>
                        )}

                        {po.status !== "CANCELLED" && (
                          <Button size="sm" variant="destructive" onClick={() => cancelPO(po.id)}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* VIEW PO */}
          <Dialog open={openViewPO} onOpenChange={setOpenViewPO}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalle de Orden de Compra</DialogTitle>
                <DialogDescription>{selectedPO?.order_number}</DialogDescription>
              </DialogHeader>

              {selectedPO && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p>
                      <strong>Proveedor:</strong> {selectedPO.supplier_name} (RUC {selectedPO.supplier_ruc})
                    </p>
                    <p>
                      <strong>Requerimiento:</strong> {selectedPO.requirement_number} — {selectedPO.requirement_title}
                    </p>
                    <p>
                      <strong>Estado:</strong>{" "}
                      <Badge className={`${poStatuses[selectedPO.status]?.color || "bg-gray-500"} text-white ml-2`}>
                        {poStatuses[selectedPO.status]?.label || selectedPO.status}
                      </Badge>
                    </p>
                    <p>
                      <strong>Fecha esperada:</strong>{" "}
                      {selectedPO.expected_date ? new Date(selectedPO.expected_date).toLocaleDateString() : "N/A"}
                    </p>
                    <p>
                      <strong>Nota:</strong> {selectedPO.note || "—"}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Items</h4>
                    <div className="space-y-2">
                      {selectedPO.items?.map((it) => (
                        <div key={it.id || `${it.description}-${it.quantity}`} className="p-3 border rounded-lg bg-gray-50">
                          <p className="font-medium">{it.description}</p>
                          <p className="text-sm text-gray-600">
                            Cantidad: {n(it.quantity)} {unitOfMeasures[it.unit_of_measure]} — S/. {money(it.unit_price)} c/u
                          </p>
                          <p className="text-sm text-gray-700 font-semibold">Subtotal línea: S/. {money(it.line_total)}</p>
                          {it.technical_specifications && (
                            <p className="text-xs text-gray-500 mt-1">Specs: {it.technical_specifications}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50">
                    <p className="font-semibold text-blue-800">
                      Subtotal: S/. {money(selectedPO.subtotal)} — Impuesto: S/. {money(selectedPO.tax)} — Total: S/.{" "}
                      {money(selectedPO.total)}
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {selectedPO?.id && (
                  <Button variant="outline" onClick={() => exportPoPdf(selectedPO.id, selectedPO.order_number)}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                )}
                <Button variant="outline" onClick={() => setOpenViewPO(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Logística</CardTitle>
              <CardDescription>Análisis y exportaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Requerimientos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Exporta PDF desde el detalle de cada requerimiento</p>
                    <Button variant="outline" className="w-full" onClick={() => toast.info("Abre un requerimiento y exporta PDF desde su detalle")}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Proveedores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Descarga lista de proveedores</p>
                    <Button variant="outline" className="w-full" onClick={exportSuppliersCsv}>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Órdenes de Compra</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Exporta PDF desde el detalle de cada OC</p>
                    <Button variant="outline" className="w-full" onClick={() => toast.info("Abre una OC y exporta PDF desde su detalle")}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* VIEW REQUIREMENT */}
      <Dialog
        open={openDialogs.viewRequirement}
        onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, viewRequirement: open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Requerimiento</DialogTitle>
            <DialogDescription>{selectedRequirement?.requirement_number}</DialogDescription>
          </DialogHeader>

          {selectedRequirement && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Información General</h4>
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>Título:</strong> {selectedRequirement.title}
                  </p>
                  <p>
                    <strong>Descripción:</strong> {selectedRequirement.description || "N/A"}
                  </p>
                  <p>
                    <strong>Justificación:</strong> {selectedRequirement.justification}
                  </p>
                  <p>
                    <strong>Fecha Requerida:</strong>{" "}
                    {selectedRequirement.required_date ? new Date(selectedRequirement.required_date).toLocaleDateString() : "No especificada"}
                  </p>
                  <p>
                    <strong>Estado:</strong>
                    <Badge className={`ml-2 ${requirementStatuses[selectedRequirement.status]?.color || "bg-gray-500"} text-white`}>
                      {requirementStatuses[selectedRequirement.status]?.label || selectedRequirement.status}
                    </Badge>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Items Solicitados</h4>
                <div className="mt-2 space-y-2">
                  {selectedRequirement.items?.map((it, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-gray-50">
                      <p className="font-medium">{it.description}</p>
                      <p className="text-sm text-gray-600">
                        Cantidad: {n(it.quantity)} {unitOfMeasures[it.unit_of_measure]} - S/. {money(it.estimated_unit_price)} c/u
                      </p>
                      {it.technical_specifications && <p className="text-xs text-gray-500 mt-1">Especificaciones: {it.technical_specifications}</p>}
                    </div>
                  ))}
                </div>

                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="font-semibold text-blue-800">Total Estimado: S/. {money(selectedRequirement.estimated_total)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedRequirement?.id && (
              <Button variant="outline" onClick={() => exportRequirementPdf(selectedRequirement.id, selectedRequirement.requirement_number)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, viewRequirement: false }))}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rechazar Requerimiento</DialogTitle>
            <DialogDescription>Opcional: agrega un motivo</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ej: No cumple presupuesto / No corresponde..." />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={rejectRequirement}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogisticsDashboard;
