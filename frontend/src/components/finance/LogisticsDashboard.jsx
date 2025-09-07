import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, 
  Truck, 
  Building, 
  FileText, 
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Edit
} from 'lucide-react';

const LogisticsDashboard = () => {
  const { user } = useContext(AuthContext);
  const [suppliers, setSuppliers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialogs, setOpenDialogs] = useState({
    newSupplier: false,
    newRequirement: false,
    viewRequirement: false,
    editSupplier: false
  });

  const [newSupplier, setNewSupplier] = useState({
    ruc: '',
    company_name: '',
    trade_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    bank_name: ''
  });

  const [newRequirement, setNewRequirement] = useState({
    title: '',
    description: '',
    justification: '',
    required_date: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    description: '',
    quantity: '',
    unit_of_measure: 'UNIT',
    estimated_unit_price: '',
    technical_specifications: ''
  });

  const [selectedRequirement, setSelectedRequirement] = useState(null);

  const requirementStatuses = {
    'DRAFT': { label: 'Borrador', color: 'bg-gray-500' },
    'SUBMITTED': { label: 'Enviado', color: 'bg-blue-500' },
    'APPROVED': { label: 'Aprobado', color: 'bg-green-500' },
    'REJECTED': { label: 'Rechazado', color: 'bg-red-500' },
    'CONVERTED_TO_PO': { label: 'Convertido a OC', color: 'bg-purple-500' }
  };

  const supplierStatuses = {
    'ACTIVE': { label: 'Activo', color: 'bg-green-500' },
    'INACTIVE': { label: 'Inactivo', color: 'bg-gray-500' },
    'BLACKLISTED': { label: 'Lista Negra', color: 'bg-red-500' }
  };

  const unitOfMeasures = {
    'UNIT': 'Unidad',
    'DOZEN': 'Docena',
    'KG': 'Kilogramo',
    'L': 'Litro',
    'M': 'Metro',
    'PKG': 'Paquete',
    'BOX': 'Caja'
  };

  useEffect(() => {
    fetchSuppliers();
    fetchRequirements();
    fetchInventoryItems();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/logistics/suppliers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchRequirements = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/logistics/requirements`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/inventory/items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInventoryItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  const validateRUC = (ruc) => {
    if (!ruc || ruc.length !== 11 || !/^\d+$/.test(ruc)) {
      return false;
    }
    
    const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const checkDigit = parseInt(ruc[10]);
    
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += parseInt(ruc[i]) * factors[i];
    }
    
    const remainder = total % 11;
    const calculatedCheckDigit = remainder >= 2 ? 11 - remainder : remainder;
    
    return checkDigit === calculatedCheckDigit;
  };

  const createSupplier = async () => {
    if (!validateRUC(newSupplier.ruc)) {
      toast({
        title: "Error",
        description: "El RUC ingresado no es válido",
        variant: "destructive"
      });
      return;
    }

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/logistics/suppliers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSupplier)
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Éxito",
          description: `Proveedor ${data.supplier.supplier_code} creado correctamente`
        });
        setOpenDialogs({ ...openDialogs, newSupplier: false });
        setNewSupplier({
          ruc: '',
          company_name: '',
          trade_name: '',
          contact_person: '',
          email: '',
          phone: '',
          address: '',
          bank_account: '',
          bank_name: ''
        });
        fetchSuppliers();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear el proveedor",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const addItemToRequirement = () => {
    if (!newItem.description || !newItem.quantity) {
      toast({
        title: "Error",
        description: "Complete la descripción y cantidad del item",
        variant: "destructive"
      });
      return;
    }

    const item = {
      ...newItem,
      quantity: parseInt(newItem.quantity),
      estimated_unit_price: parseFloat(newItem.estimated_unit_price) || 0
    };

    setNewRequirement({
      ...newRequirement,
      items: [...newRequirement.items, item]
    });

    setNewItem({
      description: '',
      quantity: '',
      unit_of_measure: 'UNIT',
      estimated_unit_price: '',
      technical_specifications: ''
    });
  };

  const removeItemFromRequirement = (index) => {
    const updatedItems = newRequirement.items.filter((_, i) => i !== index);
    setNewRequirement({ ...newRequirement, items: updatedItems });
  };

  const createRequirement = async () => {
    if (!newRequirement.title || !newRequirement.justification || newRequirement.items.length === 0) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/logistics/requirements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRequirement)
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Éxito",
          description: `Requerimiento ${data.requirement.requirement_number} creado correctamente`
        });
        setOpenDialogs({ ...openDialogs, newRequirement: false });
        setNewRequirement({
          title: '',
          description: '',
          justification: '',
          required_date: '',
          items: []
        });
        fetchRequirements();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear el requerimiento",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating requirement:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const viewRequirement = (requirement) => {
    setSelectedRequirement(requirement);
    setOpenDialogs({ ...openDialogs, viewRequirement: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {suppliers.filter(s => s.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requerimientos Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {requirements.filter(r => ['DRAFT', 'SUBMITTED'].includes(r.status)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requerimientos Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requirements.filter(r => r.status === 'APPROVED').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              S/. {requirements.reduce((sum, r) => sum + (r.estimated_total || 0), 0).toFixed(2)}
            </div>
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

        <TabsContent value="requirements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Requerimientos</CardTitle>
                <CardDescription>Solicitudes de compra y adquisiciones</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newRequirement} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newRequirement: open })}
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
                    <DialogDescription>
                      Complete los datos del requerimiento de compra
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        value={newRequirement.title}
                        onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                        placeholder="Compra de materiales de oficina"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={newRequirement.description}
                        onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                        placeholder="Descripción detallada del requerimiento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="justification">Justificación *</Label>
                      <Textarea
                        id="justification"
                        value={newRequirement.justification}
                        onChange={(e) => setNewRequirement({ ...newRequirement, justification: e.target.value })}
                        placeholder="Justificación de la compra"
                      />
                    </div>
                    <div>
                      <Label htmlFor="required_date">Fecha Requerida</Label>
                      <Input
                        id="required_date"
                        type="date"
                        value={newRequirement.required_date}
                        onChange={(e) => setNewRequirement({ ...newRequirement, required_date: e.target.value })}
                      />
                    </div>

                    {/* Items Section */}
                    <div>
                      <Label>Items del Requerimiento *</Label>
                      <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label htmlFor="item_description">Descripción</Label>
                            <Input
                              id="item_description"
                              value={newItem.description}
                              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                              placeholder="Papel Bond A4"
                            />
                          </div>
                          <div>
                            <Label htmlFor="item_quantity">Cantidad</Label>
                            <Input
                              id="item_quantity"
                              type="number"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                              placeholder="100"
                            />
                          </div>
                          <div>
                            <Label htmlFor="item_unit">Unidad de Medida</Label>
                            <Select 
                              value={newItem.unit_of_measure} 
                              onValueChange={(value) => setNewItem({ ...newItem, unit_of_measure: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(unitOfMeasures).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="item_price">Precio Estimado</Label>
                            <Input
                              id="item_price"
                              type="number"
                              step="0.01"
                              value={newItem.estimated_unit_price}
                              onChange={(e) => setNewItem({ ...newItem, estimated_unit_price: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="mb-4">
                          <Label htmlFor="item_specs">Especificaciones Técnicas</Label>
                          <Textarea
                            id="item_specs"
                            value={newItem.technical_specifications}
                            onChange={(e) => setNewItem({ ...newItem, technical_specifications: e.target.value })}
                            placeholder="Especificaciones técnicas del producto"
                          />
                        </div>
                        <Button type="button" onClick={addItemToRequirement} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Item
                        </Button>
                      </div>

                      {/* Items List */}
                      {newRequirement.items.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Items agregados:</h4>
                          <div className="space-y-2">
                            {newRequirement.items.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                <div>
                                  <p className="font-medium">{item.description}</p>
                                  <p className="text-sm text-gray-600">
                                    Cantidad: {item.quantity} {unitOfMeasures[item.unit_of_measure]} - 
                                    S/. {item.estimated_unit_price.toFixed(2)} c/u
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => removeItemFromRequirement(index)}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="font-semibold text-blue-800">
                              Total Estimado: S/. {newRequirement.items.reduce((sum, item) => 
                                sum + (item.quantity * item.estimated_unit_price), 0
                              ).toFixed(2)}
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
                  <div className="text-center py-8 text-gray-500">
                    No hay requerimientos registrados
                  </div>
                ) : (
                  requirements.map((requirement) => (
                    <div key={requirement.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{requirement.title}</p>
                          <p className="text-sm text-gray-600">{requirement.requirement_number}</p>
                          <p className="text-xs text-gray-500">
                            Solicitado por: {requirement.requester?.username || 'Usuario'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-semibold">S/. {(requirement.estimated_total || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            {requirement.required_date ? 
                              new Date(requirement.required_date).toLocaleDateString() : 
                              'Sin fecha'
                            }
                          </p>
                        </div>
                        
                        <Badge className={`${requirementStatuses[requirement.status].color} text-white`}>
                          {requirementStatuses[requirement.status].label}
                        </Badge>

                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => viewRequirement(requirement)}
                          >
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

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Proveedores</CardTitle>
                <CardDescription>Registro y evaluación de proveedores</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newSupplier} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newSupplier: open })}
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
                    <DialogDescription>
                      Complete los datos del nuevo proveedor
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ruc">RUC *</Label>
                      <Input
                        id="ruc"
                        value={newSupplier.ruc}
                        onChange={(e) => setNewSupplier({ ...newSupplier, ruc: e.target.value })}
                        placeholder="20123456789"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company_name">Razón Social *</Label>
                      <Input
                        id="company_name"
                        value={newSupplier.company_name}
                        onChange={(e) => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                        placeholder="Empresa S.A.C."
                      />
                    </div>
                    <div>
                      <Label htmlFor="trade_name">Nombre Comercial</Label>
                      <Input
                        id="trade_name"
                        value={newSupplier.trade_name}
                        onChange={(e) => setNewSupplier({ ...newSupplier, trade_name: e.target.value })}
                        placeholder="Nombre comercial"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact_person">Persona de Contacto</Label>
                      <Input
                        id="contact_person"
                        value={newSupplier.contact_person}
                        onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newSupplier.email}
                          onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                          placeholder="contacto@empresa.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={newSupplier.phone}
                          onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                          placeholder="987654321"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={newSupplier.address}
                        onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                        placeholder="Dirección completa"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bank_name">Banco</Label>
                        <Input
                          id="bank_name"
                          value={newSupplier.bank_name}
                          onChange={(e) => setNewSupplier({ ...newSupplier, bank_name: e.target.value })}
                          placeholder="Banco de Crédito del Perú"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_account">Cuenta Bancaria</Label>
                        <Input
                          id="bank_account"
                          value={newSupplier.bank_account}
                          onChange={(e) => setNewSupplier({ ...newSupplier, bank_account: e.target.value })}
                          placeholder="19123456789012345678"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createSupplier}
                      disabled={!newSupplier.ruc || !newSupplier.company_name}
                    >
                      Crear Proveedor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                {suppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay proveedores registrados
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <div key={supplier.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <Building className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{supplier.company_name}</p>
                          <p className="text-sm text-gray-600">RUC: {supplier.ruc}</p>
                          <p className="text-xs text-gray-500">{supplier.contact_person}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Código: {supplier.supplier_code}</p>
                          <p className="text-xs text-gray-500">
                            Órdenes: {supplier.total_orders || 0} | 
                            Completadas: {supplier.completed_orders || 0}
                          </p>
                        </div>
                        
                        <Badge className={`${supplierStatuses[supplier.status].color} text-white`}>
                          {supplierStatuses[supplier.status].label}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-orders">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Compra</CardTitle>
              <CardDescription>Gestión de órdenes de compra y seguimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Próximamente</h3>
                <p>La gestión de órdenes de compra estará disponible próximamente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <p className="text-sm text-gray-600 mb-4">
                      Reporte de requerimientos por período
                    </p>
                    <Button variant="outline" className="w-full">
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
                    <p className="text-sm text-gray-600 mb-4">
                      Evaluación de proveedores
                    </p>
                    <Button variant="outline" className="w-full">
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
                    <p className="text-sm text-gray-600 mb-4">
                      Seguimiento de órdenes de compra
                    </p>
                    <Button variant="outline" className="w-full">
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

      {/* View Requirement Dialog */}
      <Dialog 
        open={openDialogs.viewRequirement} 
        onOpenChange={(open) => setOpenDialogs({ ...openDialogs, viewRequirement: open })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Requerimiento</DialogTitle>
            <DialogDescription>
              {selectedRequirement?.requirement_number}
            </DialogDescription>
          </DialogHeader>
          {selectedRequirement && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Información General</h4>
                <div className="mt-2 space-y-2">
                  <p><strong>Título:</strong> {selectedRequirement.title}</p>
                  <p><strong>Descripción:</strong> {selectedRequirement.description || 'N/A'}</p>
                  <p><strong>Justificación:</strong> {selectedRequirement.justification}</p>
                  <p><strong>Fecha Requerida:</strong> {
                    selectedRequirement.required_date ? 
                    new Date(selectedRequirement.required_date).toLocaleDateString() : 
                    'No especificada'
                  }</p>
                  <p><strong>Estado:</strong> 
                    <Badge className={`ml-2 ${requirementStatuses[selectedRequirement.status].color} text-white`}>
                      {requirementStatuses[selectedRequirement.status].label}
                    </Badge>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Items Solicitados</h4>
                <div className="mt-2 space-y-2">
                  {selectedRequirement.items?.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-gray-50">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-gray-600">
                        Cantidad: {item.quantity} {unitOfMeasures[item.unit_of_measure]} - 
                        S/. {(item.estimated_unit_price || 0).toFixed(2)} c/u
                      </p>
                      {item.technical_specifications && (
                        <p className="text-xs text-gray-500 mt-1">
                          Especificaciones: {item.technical_specifications}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="font-semibold text-blue-800">
                    Total Estimado: S/. {(selectedRequirement.estimated_total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogisticsDashboard;