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
import { 
  Plus, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Eye, 
  FileText, 
  Download, 
  Truck, 
  Archive 
} from "lucide-react";

import { Inventory } from "../../services/finance.service"; 

/* =========================================================
   INVENTORY DASHBOARD (Versión Fusionada Logística)
   Mantiene el nombre del componente para no romper rutas.
========================================================= */
const InventoryDashboard = () => {
  const { user } = useContext(AuthContext);

  // Estados de datos
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [kardex, setKardex] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de interfaz (Modales)
  const [openDialogs, setOpenDialogs] = useState({
    newItem: false,
    newMovement: false,
    kardex: false,
  });

  // Formulario: Nuevo Item
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

  // Formulario: Nuevo Movimiento
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

  // Catálogos estáticos
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

  // Helper de errores
  const getErrMsg = (e, fallback = "Ocurrió un error") => {
    const msg =
      e?.response?.data?.detail ||
      e?.response?.data?.message ||
      (typeof e?.response?.data === "string" ? e.response.data : null) ||
      e?.message;
    return msg || fallback;
  };

  // Carga inicial de datos
  const loadAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, movRes, alertsRes] = await Promise.all([
        Inventory.items(),
        Inventory.movements({ limit: 20 }),
        Inventory.alerts(),
      ]);

      setItems(itemsRes.items || itemsRes || []);
      setMovements(movRes.movements || movRes.items || movRes || []);
      setAlerts(alertsRes.alerts || alertsRes.items || alertsRes || []);
    } catch (e) {
      toast.error("Error de conexión", { description: getErrMsg(e, "No se pudo cargar la logística") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Cargar Kardex específico
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

  // Acción: Crear Item
  const createItem = async () => {
    try {
      const payload = {
        ...newItem,
        min_stock: parseInt(newItem.min_stock) || 0,
        max_stock: parseInt(newItem.max_stock) || 0,
        unit_cost: parseFloat(newItem.unit_cost) || 0,
      };

      await Inventory.createItem(payload);
      toast.success("Éxito", { description: "Material registrado en catálogo" });

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
      toast.error("Error", { description: getErrMsg(e, "No se pudo crear el material") });
    }
  };

  // Acción: Registrar Movimiento
  const createMovement = async () => {
    try {
      const payload = {
        ...newMovement,
        quantity: parseInt(newMovement.quantity),
        unit_cost: newMovement.unit_cost ? parseFloat(newMovement.unit_cost) : null,
        expiry_date: newMovement.expiry_date || null,
      };

      await Inventory.createMovement(payload);
      toast.success("Operación Exitosa", { description: "Movimiento de almacén registrado" });

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
      toast.error("Error", { description: getErrMsg(e, "No se pudo registrar la operación") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Cálculos rápidos
  const totalStock = items.reduce((sum, item) => sum + (item.current_stock || 0), 0);
  const totalValue = items
    .reduce(
      (sum, item) => sum + Number(item.current_stock ?? 0) * Number(item.unit_cost ?? 0),
      0
    )
    .toFixed(2);

 return (
    <div className="space-y-8 pb-24 sm:pb-8 animate-in fade-in duration-700">
      
      {/* === HEADER CON DEGRADADO (Texto Blanco) === */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 shadow-xl border border-slate-700/50">
        {/* Elementos decorativos de fondo */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-inner">
                <Truck className="h-8 w-8 text-blue-300" />
              </div>
              Logística y Almacén
            </h1>
            <p className="text-slate-300 text-lg font-light ml-16 max-w-2xl opacity-90">
              Gestión centralizada de inventario, suministros y operaciones.
            </p>
          </div>
          
          {/* Botón de acción rápida en el header */}
          <div className="flex gap-3">
             <Button 
                onClick={() => setOpenDialogs(prev => ({...prev, newMovement: true}))}
                className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 border-0 transition-all hover:scale-105"
             >
                <TrendingUp className="mr-2 h-4 w-4" /> Registrar Operación
             </Button>
          </div>
        </div>
      </div>

      {/* === ESTADÍSTICAS (Tarjetas Modernas) === */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: "Total Materiales", value: items.length, icon: Package, color: "text-blue-600", border: "border-blue-500", bgIcon: "bg-blue-50" },
          { title: "Stock Físico", value: totalStock, icon: Archive, color: "text-emerald-600", border: "border-emerald-500", bgIcon: "bg-emerald-50" },
          { title: "Alertas Stock", value: alerts.length, icon: AlertTriangle, color: "text-orange-600", border: "border-orange-500", bgIcon: "bg-orange-50" },
          { title: "Valorización (S/.)", value: totalValue, icon: TrendingUp, color: "text-purple-600", border: "border-purple-500", bgIcon: "bg-purple-50" },
        ].map((stat, i) => (
          <Card key={i} className={`border-l-4 ${stat.border} shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                  <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                </div>
                <div className={`p-4 rounded-2xl ${stat.bgIcon} shadow-sm`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === SECCIÓN DE ALERTAS === */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 animate-in slide-in-from-top-2 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-900">Atención Requerida</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-xl shadow-sm hover:border-red-300 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{alert.item_name}</p>
                  <p className="text-xs text-red-500 truncate font-medium">{alert.message}</p>
                </div>
                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0 ml-2 shadow-none">{alert.severity}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === TABS PRINCIPALES === */}
      <Tabs defaultValue="items" className="space-y-6">
        <TabsList className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto inline-flex h-auto">
          <TabsTrigger value="items" className="rounded-lg py-2.5 px-6 font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
             <Package className="w-4 h-4 mr-2" /> Catálogo & Stock
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-lg py-2.5 px-6 font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
             <TrendingUp className="w-4 h-4 mr-2" /> Operaciones
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg py-2.5 px-6 font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
             <FileText className="w-4 h-4 mr-2" /> Reportes
          </TabsTrigger>
        </TabsList>

        {/* --- TAB ITEMS --- */}
        <TabsContent value="items" className="animate-in fade-in zoom-in-95 duration-300">
          <Card className="border-slate-200 shadow-md overflow-hidden bg-white">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                  <h3 className="text-lg font-bold text-slate-800">Inventario de Materiales</h3>
                  <p className="text-sm text-slate-500">Listado maestro de productos y existencias</p>
               </div>
               
               {/* MODAL NUEVO ITEM */}
               <Dialog open={openDialogs.newItem} onOpenChange={(v) => setOpenDialogs(prev => ({...prev, newItem: v}))}>
                  <DialogTrigger asChild>
                     <Button variant="outline" className="border-slate-300 hover:bg-white hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                        <Plus className="h-4 w-4 mr-2" /> Nuevo Material
                     </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                     <DialogHeader>
                        <DialogTitle>Crear Material</DialogTitle>
                        <DialogDescription>Añadir un nuevo item al catálogo.</DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                        <div className="grid gap-2">
                           <Label>Nombre del Producto</Label>
                           <Input placeholder="Ej. Papel Bond A4" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2">
                              <Label>Código</Label>
                              <Input placeholder="MAT-001" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="rounded-lg" />
                           </div>
                           <div className="grid gap-2">
                              <Label>Categoría</Label>
                              <Input placeholder="Oficina" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="rounded-lg" />
                           </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Unidad de Medida</Label>
                            <Select value={newItem.unit_of_measure} onValueChange={v => setNewItem({...newItem, unit_of_measure: v})}>
                                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(unitOfMeasures).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Stock Mín</Label>
                                <Input type="number" value={newItem.min_stock} onChange={e => setNewItem({...newItem, min_stock: e.target.value})} className="rounded-lg" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Stock Máx</Label>
                                <Input type="number" value={newItem.max_stock} onChange={e => setNewItem({...newItem, max_stock: e.target.value})} className="rounded-lg" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Costo Ref. (S/.)</Label>
                            <Input type="number" step="0.01" value={newItem.unit_cost} onChange={e => setNewItem({...newItem, unit_cost: e.target.value})} className="rounded-lg" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Descripción</Label>
                            <Textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="rounded-lg" />
                        </div>
                     </div>
                     <DialogFooter>
                        <Button onClick={createItem} className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-lg">Guardar en Catálogo</Button>
                     </DialogFooter>
                  </DialogContent>
               </Dialog>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4 bg-slate-50/30">
               {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                     <div className="bg-slate-100 p-6 rounded-full mb-4">
                        <Archive className="h-10 w-10 text-slate-300" />
                     </div>
                     <p>No se encontraron materiales.</p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     {items.map((item) => {
                        // Cálculo simple para la barra visual (si max_stock es 0, evitamos división por 0)
                        const stockPct = item.max_stock > 0 ? (item.current_stock / item.max_stock) * 100 : 0;
                        const isLow = item.current_stock <= item.min_stock;
                        
                        return (
                           <div key={item.id} className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all duration-200">
                              <div className="flex flex-col sm:flex-row justify-between gap-4">
                                 {/* Info Principal */}
                                 <div className="flex items-start gap-4">
                                    <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border border-blue-100 text-blue-600 font-bold text-lg shadow-sm">
                                       {item.name.charAt(0)}
                                    </div>
                                    <div>
                                       <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors text-base">{item.name}</h4>
                                       <div className="flex flex-wrap gap-2 mt-1">
                                          <Badge variant="secondary" className="text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200">{item.code}</Badge>
                                          <span className="text-xs text-slate-400 flex items-center">• {item.category}</span>
                                       </div>
                                    </div>
                                 </div>

                                 {/* Stock Info & Visual */}
                                 <div className="flex items-center gap-6 flex-1 justify-end">
                                    <div className="w-full max-w-[140px] hidden sm:block">
                                       <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium">
                                          <span>Min: {item.min_stock}</span>
                                          <span>Max: {item.max_stock}</span>
                                       </div>
                                       {/* Barra de progreso visual manual */}
                                       <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                          <div 
                                             className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                             style={{ width: `${Math.min(stockPct, 100)}%` }}
                                          ></div>
                                       </div>
                                    </div>

                                    <div className="text-right min-w-[80px]">
                                       <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Stock</span>
                                       <span className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                                          {item.current_stock || 0}
                                       </span>
                                    </div>

                                    <Button variant="ghost" size="icon" onClick={() => fetchKardex(item.id)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                       <Eye className="h-5 w-5" />
                                    </Button>
                                 </div>
                              </div>
                           </div>
                        )
                     })}
                  </div>
               )}
            </div>
          </Card>
        </TabsContent>

        {/* --- TAB MOVIMIENTOS --- */}
        <TabsContent value="movements" className="animate-in fade-in zoom-in-95 duration-300">
           <Card className="border-slate-200 shadow-md overflow-hidden bg-white">
             <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Historial de Operaciones</h3>
                   <p className="text-sm text-slate-500">Registro detallado de entradas y salidas</p>
                </div>
                
                <Dialog open={openDialogs.newMovement} onOpenChange={(v) => setOpenDialogs(prev => ({...prev, newMovement: v}))}>
                   <DialogTrigger asChild>
                      <Button className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all">
                         <Plus className="h-4 w-4 mr-2" /> Registrar Operación
                      </Button>
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-lg rounded-2xl">
                      <DialogHeader>
                         <DialogTitle>Registrar Movimiento</DialogTitle>
                         <DialogDescription>Entrada o salida de material del almacén.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                         <div className="grid gap-2">
                             <Label>Material</Label>
                             <Select value={newMovement.item_id} onValueChange={v => setNewMovement({...newMovement, item_id: v})}>
                                 <SelectTrigger className="rounded-lg bg-slate-50"><SelectValue placeholder="Seleccionar material..." /></SelectTrigger>
                                 <SelectContent className="max-h-60">
                                     {items.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.code} - {i.name}</SelectItem>)}
                                 </SelectContent>
                             </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                 <Label>Tipo Operación</Label>
                                 <Select value={newMovement.movement_type} onValueChange={v => setNewMovement({...newMovement, movement_type: v})}>
                                     <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         {Object.entries(movementTypes).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                                     </SelectContent>
                                 </Select>
                             </div>
                             <div className="grid gap-2">
                                 <Label>Cantidad</Label>
                                 <Input type="number" value={newMovement.quantity} onChange={e => setNewMovement({...newMovement, quantity: e.target.value})} className="rounded-lg font-bold text-lg" />
                             </div>
                         </div>
                         <div className="grid gap-2">
                             <Label>Motivo</Label>
                             <Input value={newMovement.reason} onChange={e => setNewMovement({...newMovement, reason: e.target.value})} className="rounded-lg" placeholder="Ej. Compra, Merma, Uso interno" />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2"><Label>Costo Unit.</Label><Input type="number" step="0.01" value={newMovement.unit_cost} onChange={e => setNewMovement({...newMovement, unit_cost: e.target.value})} className="rounded-lg" /></div>
                             <div className="grid gap-2"><Label>Lote (Opcional)</Label><Input value={newMovement.batch_number} onChange={e => setNewMovement({...newMovement, batch_number: e.target.value})} className="rounded-lg" /></div>
                         </div>
                         <div className="grid gap-2">
                             <Label>Observaciones</Label>
                             <Textarea value={newMovement.notes} onChange={e => setNewMovement({...newMovement, notes: e.target.value})} className="rounded-lg" />
                         </div>
                      </div>
                      <DialogFooter>
                         <Button onClick={createMovement} disabled={!newMovement.item_id || !newMovement.quantity || !newMovement.reason} className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg font-bold">Procesar Operación</Button>
                      </DialogFooter>
                   </DialogContent>
                </Dialog>
             </div>

             <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                 {movements.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <TrendingUp className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                        Sin movimientos recientes
                    </div>
                 ) : (
                    <div className="divide-y divide-slate-100">
                       {movements.map((mov) => {
                          const isEntry = mov.movement_type === 'ENTRY';
                          return (
                             <div key={mov.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                   <div className={`p-3 rounded-full shadow-sm ${isEntry ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {isEntry ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                   </div>
                                   <div>
                                      <p className="font-bold text-slate-800 text-sm">{mov.item?.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEntry ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                            {movementTypes[mov.movement_type]}
                                         </span>
                                         <span className="text-xs text-slate-400">• {mov.reason}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <span className={`text-lg font-bold block ${isEntry ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {isEntry ? '+' : '-'}{mov.quantity}
                                   </span>
                                   <span className="text-[10px] text-slate-400 font-medium">{new Date(mov.created_at).toLocaleDateString()}</span>
                                </div>
                             </div>
                          )
                       })}
                    </div>
                 )}
             </div>
           </Card>
        </TabsContent>

        {/* --- TAB REPORTES --- */}
        <TabsContent value="reports" className="animate-in fade-in zoom-in-95 duration-300">
           <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                 <CardTitle>Centro de Reportes</CardTitle>
                 <CardDescription>Descarga de información contable y de auditoría.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                       { title: "Valorización", desc: "Costo total actual del inventario.", icon: FileText },
                       { title: "Kardex General", desc: "Historial completo de movimientos.", icon: TrendingUp },
                       { title: "Reposición", desc: "Materiales bajo stock mínimo.", icon: Download }
                    ].map((rep, i) => (
                       <div key={i} className="group border border-slate-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer bg-white">
                          <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                             <rep.icon className="h-6 w-6" />
                          </div>
                          <h4 className="font-bold text-slate-800 mb-2 text-lg">{rep.title}</h4>
                          <p className="text-sm text-slate-500 mb-6">{rep.desc}</p>
                          <Button variant="outline" className="w-full border-slate-200 group-hover:border-blue-500 group-hover:text-blue-600 font-medium">Generar Reporte</Button>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* === MODAL DETALLE KARDEX === */}
      <Dialog open={openDialogs.kardex} onOpenChange={(v) => setOpenDialogs(prev => ({...prev, kardex: v}))}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
               <div className="p-2 bg-slate-100 rounded-lg"><FileText className="h-4 w-4 text-slate-600" /></div>
               Kardex: {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto mt-2 border rounded-xl shadow-inner bg-slate-50">
            <table className="w-full text-sm text-left">
              <thead className="bg-white sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="p-4 font-bold text-slate-700">Fecha</th>
                  <th className="p-4 font-bold text-slate-700">Movimiento</th>
                  <th className="p-4 font-bold text-slate-700 text-right">Entrada</th>
                  <th className="p-4 font-bold text-slate-700 text-right">Salida</th>
                  <th className="p-4 font-bold text-slate-700 text-right">Saldo</th>
                  <th className="p-4 font-bold text-slate-700 text-right">Costo U.</th>
                  <th className="p-4 font-bold text-slate-700 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {kardex.map((k, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 text-slate-500 font-medium">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">{movementTypes[k.movement_type]}</Badge>
                    </td>
                    <td className="p-4 text-right font-medium text-emerald-600">{k.movement_type === 'ENTRY' ? k.quantity : '-'}</td>
                    <td className="p-4 text-right font-medium text-rose-600">{k.movement_type !== 'ENTRY' ? k.quantity : '-'}</td>
                    <td className="p-4 text-right font-bold text-slate-800">{k.running_stock}</td>
                    <td className="p-4 text-right text-slate-500">S/. {Number(k.unit_cost || 0).toFixed(2)}</td>
                    <td className="p-4 text-right text-slate-500">S/. {Number(k.running_value || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="mt-4">
             <Button variant="outline"><Download className="h-4 w-4 mr-2"/> Exportar Excel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default InventoryDashboard;