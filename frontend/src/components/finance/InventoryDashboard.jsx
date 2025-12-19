import React, { useState, useEffect, useContext } from "react";
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
import { Plus, Package, TrendingUp, TrendingDown, AlertTriangle, Eye, FileText, Download } from "lucide-react";

import { Inventory } from "../../services/finance.service"; // ✅ aquí está la magia

const InventoryDashboard = () => {
  const { user } = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [kardex, setKardex] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openDialogs, setOpenDialogs] = useState({
    newItem: false,
    newMovement: false,
    kardex: false,
    editItem: false,
  });

  const [newItem, setNewItem] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    unit_of_measure: "UNIT",
    min_stock: "",
    max_stock: "",
    unit_cost: "",
  });

  const [newMovement, setNewMovement] = useState({
    item_id: "",
    movement_type: "ENTRY",
    quantity: "",
    unit_cost: "",
    reason: "",
    notes: "",
    batch_number: "",
    expiry_date: "",
  });

  const unitOfMeasures = {
    UNIT: "Unidad",
    DOZEN: "Docena",
    KG: "Kilogramo",
    L: "Litro",
    M: "Metro",
    PKG: "Paquete",
    BOX: "Caja",
  };

  const movementTypes = {
    ENTRY: "Entrada",
    EXIT: "Salida",
    TRANSFER: "Transferencia",
    ADJUSTMENT: "Ajuste",
  };

  // ✅ helper para sacar error del backend (DRF / Django / etc.)
  const getErrMsg = (e, fallback = "Ocurrió un error") => {
    const msg =
      e?.response?.data?.detail ||
      e?.response?.data?.message ||
      (typeof e?.response?.data === "string" ? e.response.data : null) ||
      e?.message;
    return msg || fallback;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, movRes, alertsRes] = await Promise.all([
        Inventory.items(),
        Inventory.movements({ limit: 20 }),
        Inventory.alerts(),
      ]);

      // según tu backend puede ser {items: []} o {items:...}
      setItems(itemsRes.items || itemsRes || []);
      setMovements(movRes.movements || movRes.items || movRes || []);
      setAlerts(alertsRes.alerts || alertsRes.items || alertsRes || []);
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo cargar inventario") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const fetchKardex = async (itemId) => {
    try {
      const data = await Inventory.kardex(itemId);
      setKardex(data.kardex || data.items || data || []);
      setSelectedItem(data.item || items.find((x) => x.id === itemId) || null);
      setOpenDialogs((prev) => ({ ...prev, kardex: true }));
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo cargar el kardex") });
    }
  };

  const createItem = async () => {
    try {
      const payload = {
        ...newItem,
        min_stock: parseInt(newItem.min_stock) || 0,
        max_stock: parseInt(newItem.max_stock) || 0,
        unit_cost: parseFloat(newItem.unit_cost) || 0,
      };

      await Inventory.createItem(payload);

      toast.success("Éxito", { description: "Item creado correctamente" });

      setOpenDialogs((prev) => ({ ...prev, newItem: false }));
      setNewItem({
        code: "",
        name: "",
        description: "",
        category: "",
        unit_of_measure: "UNIT",
        min_stock: "",
        max_stock: "",
        unit_cost: "",
      });

      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo crear el item") });
    }
  };

  const createMovement = async () => {
    try {
      const payload = {
        ...newMovement,
        quantity: parseInt(newMovement.quantity),
        unit_cost: newMovement.unit_cost ? parseFloat(newMovement.unit_cost) : null,
        expiry_date: newMovement.expiry_date || null,
      };

      await Inventory.createMovement(payload);

      toast.success("Éxito", { description: "Movimiento registrado correctamente" });

      setOpenDialogs((prev) => ({ ...prev, newMovement: false }));
      setNewMovement({
        item_id: "",
        movement_type: "ENTRY",
        quantity: "",
        unit_cost: "",
        reason: "",
        notes: "",
        batch_number: "",
        expiry_date: "",
      });

      await loadAll();
    } catch (e) {
      toast.error("Error", { description: getErrMsg(e, "No se pudo registrar el movimiento") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalStock = items.reduce((sum, item) => sum + (item.current_stock || 0), 0);
  const totalValue = items
    .reduce(
      (sum, item) => sum + Number(item.current_stock ?? 0) * Number(item.unit_cost ?? 0),
      0
    )
    .toFixed(2);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{items.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalStock}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{alerts.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">S/. {totalValue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Alertas de Inventario</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-red-800">{alert.message}</p>
                    <p className="text-sm text-red-600">
                      {alert.item_code} - {alert.item_name}
                    </p>
                  </div>
                  <Badge variant="destructive">{alert.severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* ITEMS */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Items</CardTitle>
                <CardDescription>Catálogo de productos e inventario</CardDescription>
              </div>

              <Dialog
                open={openDialogs.newItem}
                onOpenChange={(open) => setOpenDialogs((prev) => ({ ...prev, newItem: open }))}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Item
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Item</DialogTitle>
                    <DialogDescription>Complete los datos del nuevo producto</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="code">Código *</Label>
                      <Input
                        id="code"
                        value={newItem.code}
                        onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                        placeholder="ITM001"
                      />
                    </div>

                    <div>
                      <Label htmlFor="name">Nombre *</Label>
                      <Input
                        id="name"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        placeholder="Papel Bond A4"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="Descripción detallada del producto"
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Categoría</Label>
                      <Input
                        id="category"
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        placeholder="Materiales de Oficina"
                      />
                    </div>

                    <div>
                      <Label htmlFor="unit_of_measure">Unidad de Medida *</Label>
                      <Select
                        value={newItem.unit_of_measure}
                        onValueChange={(value) => setNewItem({ ...newItem, unit_of_measure: value })}
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="min_stock">Stock Mínimo</Label>
                        <Input
                          id="min_stock"
                          type="number"
                          value={newItem.min_stock}
                          onChange={(e) => setNewItem({ ...newItem, min_stock: e.target.value })}
                          placeholder="10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="max_stock">Stock Máximo</Label>
                        <Input
                          id="max_stock"
                          type="number"
                          value={newItem.max_stock}
                          onChange={(e) => setNewItem({ ...newItem, max_stock: e.target.value })}
                          placeholder="100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="unit_cost">Costo Unitario</Label>
                      <Input
                        id="unit_cost"
                        type="number"
                        step="0.01"
                        value={newItem.unit_cost}
                        onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={createItem} disabled={!newItem.code || !newItem.name}>
                      Crear Item
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay items registrados</div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <Package className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-gray-600">{item.code}</p>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-semibold">Stock: {item.current_stock || 0}</p>
                          <p className="text-sm text-gray-600">
                            Min: {item.min_stock} | Max: {item.max_stock}
                          </p>
                          <p className="text-xs text-gray-500">S/. {Number(item.unit_cost ?? 0).toFixed(2)} c/u</p>
                        </div>

                        {(item.current_stock || 0) <= (item.min_stock || 0) && (
                          <Badge variant="destructive">Stock Bajo</Badge>
                        )}

                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => fetchKardex(item.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MOVEMENTS */}
        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Movimientos de Inventario</CardTitle>
                <CardDescription>Registro de entradas, salidas y transferencias</CardDescription>
              </div>

              <Dialog
                open={openDialogs.newMovement}
                onOpenChange={(open) => setOpenDialogs((prev) => ({ ...prev, newMovement: open }))}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Movimiento
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Movimiento</DialogTitle>
                    <DialogDescription>Complete los datos del movimiento de inventario</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="item_select">Item *</Label>
                      <Select
                        value={newMovement.item_id}
                        onValueChange={(value) => setNewMovement({ ...newMovement, item_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.code} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="movement_type">Tipo de Movimiento *</Label>
                      <Select
                        value={newMovement.movement_type}
                        onValueChange={(value) => setNewMovement({ ...newMovement, movement_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(movementTypes).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quantity">Cantidad *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={newMovement.quantity}
                          onChange={(e) => setNewMovement({ ...newMovement, quantity: e.target.value })}
                          placeholder="1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="unit_cost">Costo Unitario</Label>
                        <Input
                          id="unit_cost"
                          type="number"
                          step="0.01"
                          value={newMovement.unit_cost}
                          onChange={(e) => setNewMovement({ ...newMovement, unit_cost: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reason">Motivo *</Label>
                      <Input
                        id="reason"
                        value={newMovement.reason}
                        onChange={(e) => setNewMovement({ ...newMovement, reason: e.target.value })}
                        placeholder="Compra, venta, ajuste, etc."
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes">Observaciones</Label>
                      <Textarea
                        id="notes"
                        value={newMovement.notes}
                        onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
                        placeholder="Observaciones adicionales"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="batch_number">Número de Lote</Label>
                        <Input
                          id="batch_number"
                          value={newMovement.batch_number}
                          onChange={(e) => setNewMovement({ ...newMovement, batch_number: e.target.value })}
                          placeholder="LT001"
                        />
                      </div>

                      <div>
                        <Label htmlFor="expiry_date">Fecha de Vencimiento</Label>
                        <Input
                          id="expiry_date"
                          type="date"
                          value={newMovement.expiry_date}
                          onChange={(e) => setNewMovement({ ...newMovement, expiry_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={createMovement}
                      disabled={!newMovement.item_id || !newMovement.quantity || !newMovement.reason}
                    >
                      Registrar Movimiento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {movements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay movimientos registrados</div>
                ) : (
                  movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {movement.movement_type === "ENTRY" ? (
                          <TrendingUp className="h-8 w-8 text-green-500" />
                        ) : (
                          <TrendingDown className="h-8 w-8 text-red-500" />
                        )}

                        <div>
                          <p className="font-semibold">{movement.item?.name}</p>
                          <p className="text-sm text-gray-600">{movementTypes[movement.movement_type]}</p>
                          <p className="text-xs text-gray-500">{movement.reason}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          {movement.movement_type === "ENTRY" ? "+" : "-"}
                          {movement.quantity}
                        </p>
                        <p className="text-sm text-gray-600">
                          {movement.unit_cost ? `S/. ${Number(movement.unit_cost).toFixed(2)}` : "Sin costo"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {movement.created_at ? new Date(movement.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Inventario</CardTitle>
              <CardDescription>Análisis y exportaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Valorización</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Reporte de valorización del inventario</p>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Movimientos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Reporte de movimientos por período</p>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stock Mínimos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Items con stock bajo o agotado</p>
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* KARDEX */}
      <Dialog
        open={openDialogs.kardex}
        onOpenChange={(open) => setOpenDialogs((prev) => ({ ...prev, kardex: open }))}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Kardex - {selectedItem?.name}</DialogTitle>
            <DialogDescription>Historial completo de movimientos con cálculo FIFO</DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Costo Unit.</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {kardex.map((entry, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</td>
                    <td className="p-2">
                      <Badge variant={entry.movement_type === "ENTRY" ? "default" : "secondary"}>
                        {movementTypes[entry.movement_type]}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      {entry.movement_type === "ENTRY" ? "+" : "-"}
                      {entry.quantity}
                    </td>
                    <td className="p-2 text-right">S/. {Number(entry.unit_cost || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">{entry.running_stock}</td>
                    <td className="p-2 text-right">S/. {Number(entry.running_value || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Kardex
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryDashboard;
