import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../../utils/safeToast';
import {
  Plus,
  Receipt,
  QrCode,
  Download,
  CreditCard,
  X,
  CheckCircle,
  FileText
} from 'lucide-react';

const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

const ReceiptsDashboard = () => {
  const { user } = useContext(AuthContext);
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialogs, setOpenDialogs] = useState({
    newReceipt: false,
    payReceipt: false,
    cancelReceipt: false,
    verifyReceipt: false
  });

  const [filters, setFilters] = useState({
    status: '',
    concept: '',
    customer_document: '',
    date_from: '',
    date_to: ''
  });

  const [newReceipt, setNewReceipt] = useState({
    concept: 'ENROLLMENT',
    description: '',
    amount: '',
    customer_name: '',
    customer_document: '',
    customer_email: '',
    due_date: ''
  });

  const [paymentData, setPaymentData] = useState({
    receipt_id: '',
    payment_method: 'CASH',
    payment_reference: '',
    idempotency_key: ''
  });

  const receiptConcepts = {
    ENROLLMENT: 'Matrícula',
    TUITION: 'Pensión',
    CERTIFICATE: 'Constancia/Certificado',
    PROCEDURE: 'Trámite',
    ACADEMIC_SERVICES: 'Servicios Académicos',
    OTHER: 'Otros'
  };

  const paymentMethods = {
    CASH: 'Efectivo',
    BANK_DEPOSIT: 'Depósito Bancario',
    BANK_TRANSFER: 'Transferencia Bancaria',
    CHECK: 'Cheque',
    DEBIT_CARD: 'Tarjeta de Débito',
    CREDIT_CARD: 'Tarjeta de Crédito'
  };

  const receiptStatuses = {
    PENDING: { label: 'Pendiente', color: 'bg-yellow-500' },
    PAID: { label: 'Pagado', color: 'bg-green-500' },
    CANCELLED: { label: 'Anulado', color: 'bg-red-500' },
    REFUNDED: { label: 'Reembolsado', color: 'bg-blue-500' }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    filterReceipts();
  }, [receipts, filters]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${backendUrl}/api/finance/receipts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReceipts(data.receipts || []);
      } else {
        toast.error('Error', {
          description: 'No se pudieron cargar las boletas'
        });
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
      toast.error('Error', {
        description: 'Error de conexión'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterReceipts = () => {
    let filtered = receipts;

    if (filters.status) {
      filtered = filtered.filter((r) => r.status === filters.status);
    }

    if (filters.concept) {
      filtered = filtered.filter((r) => r.concept === filters.concept);
    }

    if (filters.customer_document) {
      filtered = filtered.filter((r) =>
        r.customer_document.includes(filters.customer_document)
      );
    }

    if (filters.date_from) {
      filtered = filtered.filter(
        (r) => new Date(r.issued_at) >= new Date(filters.date_from)
      );
    }

    if (filters.date_to) {
      filtered = filtered.filter(
        (r) => new Date(r.issued_at) <= new Date(filters.date_to)
      );
    }

    setFilteredReceipts(filtered);
  };

  const createReceipt = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${backendUrl}/api/finance/receipts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newReceipt,
          amount: parseFloat(newReceipt.amount),
          due_date: newReceipt.due_date || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Éxito', {
          description: `Boleta ${data.receipt.receipt_number} creada correctamente`
        });
        setOpenDialogs((prev) => ({ ...prev, newReceipt: false }));
        setNewReceipt({
          concept: 'ENROLLMENT',
          description: '',
          amount: '',
          customer_name: '',
          customer_document: '',
          customer_email: '',
          due_date: ''
        });
        fetchReceipts();
      } else {
        const error = await response.json();
        toast.error('Error', {
          description: error.detail || 'No se pudo crear la boleta'
        });
      }
    } catch (error) {
      console.error('Error creating receipt:', error);
      toast.error('Error', {
        description: 'Error de conexión'
      });
    }
  };

  const payReceipt = async () => {
    try {
      const token = localStorage.getItem('token');

      const idempotencyKey =
        paymentData.idempotency_key || `payment_${Date.now()}_${Math.random()}`;

      const response = await fetch(
        `${backendUrl}/api/finance/receipts/${paymentData.receipt_id}/pay`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            payment_method: paymentData.payment_method,
            payment_reference: paymentData.payment_reference || null
          })
        }
      );

      if (response.ok) {
        toast.success('Éxito', {
          description: 'Pago registrado correctamente'
        });
        setOpenDialogs((prev) => ({ ...prev, payReceipt: false }));
        setPaymentData({
          receipt_id: '',
          payment_method: 'CASH',
          payment_reference: '',
          idempotency_key: ''
        });
        fetchReceipts();
      } else {
        const error = await response.json();
        toast.error('Error', {
          description: error.detail || 'No se pudo registrar el pago'
        });
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error', {
        description: 'Error de conexión'
      });
    }
  };

  const cancelReceipt = async (receiptId, reason) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${backendUrl}/api/finance/receipts/${receiptId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        }
      );

      if (response.ok) {
        toast.success('Éxito', {
          description: 'Boleta anulada correctamente'
        });
        fetchReceipts();
      } else {
        const error = await response.json();
        toast.error('Error', {
          description: error.detail || 'No se pudo anular la boleta'
        });
      }
    } catch (error) {
      console.error('Error canceling receipt:', error);
      toast.error('Error', {
        description: 'Error de conexión'
      });
    }
  };

  const downloadReceiptPDF = async (receiptId, receiptNumber) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${backendUrl}/api/finance/receipts/${receiptId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boleta_${receiptNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('Éxito', {
          description: 'PDF descargado correctamente'
        });
      } else {
        toast.error('Error', {
          description: 'No se pudo descargar el PDF'
        });
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error', {
        description: 'Error de conexión'
      });
    }
  };

  const openVerificationUrl = (receiptId) => {
    const verificationUrl = `${backendUrl}/api/verificar/${receiptId}`;
    window.open(verificationUrl, '_blank');
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      concept: '',
      customer_document: '',
      date_from: '',
      date_to: ''
    });
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
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {receipts.filter((r) => r.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pagadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {receipts.filter((r) => r.status === 'PAID').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              S/.{' '}
              {receipts
                .filter(
                  (r) =>
                    r.status === 'PAID' &&
                    new Date(r.issued_at).toDateString() ===
                    new Date().toDateString()
                )
                .reduce((sum, r) => sum + r.amount, 0)
                .toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              S/.{' '}
              {receipts
                .filter(
                  (r) =>
                    r.status === 'PAID' &&
                    new Date(r.issued_at).getMonth() ===
                    new Date().getMonth()
                )
                .reduce((sum, r) => sum + r.amount, 0)
                .toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receipts">
        <TabsList>
          <TabsTrigger value="receipts">Boletas</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Boletas Internas</CardTitle>
                <CardDescription>
                  Emisión y control de boletas no tributarias
                </CardDescription>
              </div>
              <Dialog
                open={openDialogs.newReceipt}
                onOpenChange={(open) =>
                  setOpenDialogs((prev) => ({ ...prev, newReceipt: open }))
                }
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Boleta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Boleta</DialogTitle>
                    <DialogDescription>
                      Complete los datos para generar una boleta interna
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="concept">Concepto *</Label>
                      <Select
                        value={newReceipt.concept}
                        onValueChange={(value) =>
                          setNewReceipt((prev) => ({ ...prev, concept: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(receiptConcepts).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">Descripción *</Label>
                      <Input
                        id="description"
                        value={newReceipt.description}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            description: e.target.value
                          }))
                        }
                        placeholder="Descripción del servicio"
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount">Monto *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newReceipt.amount}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            amount: e.target.value
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer_name">
                        Nombre del Cliente *
                      </Label>
                      <Input
                        id="customer_name"
                        value={newReceipt.customer_name}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            customer_name: e.target.value
                          }))
                        }
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer_document">Documento *</Label>
                      <Input
                        id="customer_document"
                        value={newReceipt.customer_document}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            customer_document: e.target.value
                          }))
                        }
                        placeholder="DNI o RUC"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer_email">Email</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={newReceipt.customer_email}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            customer_email: e.target.value
                          }))
                        }
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="due_date">Fecha de Vencimiento</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={newReceipt.due_date}
                        onChange={(e) =>
                          setNewReceipt((prev) => ({
                            ...prev,
                            due_date: e.target.value
                          }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={createReceipt}
                      disabled={
                        !newReceipt.description ||
                        !newReceipt.amount ||
                        !newReceipt.customer_name ||
                        !newReceipt.customer_document
                      }
                    >
                      Crear Boleta
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              {/* Filters */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Filtros</h3>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpiar
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Estado</Label>
                    <Select
                      value={filters.status || 'ALL'}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: value === 'ALL' ? '' : value
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        {Object.entries(receiptStatuses).map(
                          ([key, { label }]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Concepto</Label>
                    <Select
                      value={filters.concept || 'ALL'}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          concept: value === 'ALL' ? '' : value
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        {Object.entries(receiptConcepts).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Documento</Label>
                    <Input
                      value={filters.customer_document}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          customer_document: e.target.value
                        }))
                      }
                      placeholder="DNI/RUC"
                    />
                  </div>
                  <div>
                    <Label>Fecha Desde</Label>
                    <Input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_from: e.target.value
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Fecha Hasta</Label>
                    <Input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_to: e.target.value
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Receipts List */}
              <div className="space-y-3">
                {filteredReceipts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron boletas
                  </div>
                ) : (
                  filteredReceipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <Receipt className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">
                            {receipt.receipt_number}
                          </p>
                          <p className="text-sm text-gray-600">
                            {receiptConcepts[receipt.concept]}
                          </p>
                          <p className="text-xs text-gray-500">
                            {receipt.customer_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-semibold">
                            S/. {receipt.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              receipt.issued_at
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <Badge
                          className={`${receiptStatuses[receipt.status].color} text-white`}
                        >
                          {receiptStatuses[receipt.status].label}
                        </Badge>

                        <div className="flex space-x-2">
                          {receipt.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPaymentData((prev) => ({
                                  ...prev,
                                  receipt_id: receipt.id
                                }));
                                setOpenDialogs((prev) => ({
                                  ...prev,
                                  payReceipt: true
                                }));
                              }}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            data-testid="receipt-view"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadReceiptPDF(
                                receipt.id,
                                receipt.receipt_number
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            data-testid="receipt-verify-qr"
                            size="sm"
                            variant="outline"
                            onClick={() => openVerificationUrl(receipt.id)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>

                          {user?.role === 'FINANCE_ADMIN' &&
                            receipt.status !== 'CANCELLED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reason =
                                    prompt('Motivo de anulación:');
                                  if (reason) {
                                    cancelReceipt(receipt.id, reason);
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Boletas</CardTitle>
              <CardDescription>Análisis y exportaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Reporte Diario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Boletas emitidas y pagadas del día
                    </p>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Reporte Mensual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Resumen del mes por conceptos
                    </p>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Exportar Datos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Exportar en formato CSV
                    </p>
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

      {/* Payment Dialog */}
      <Dialog
        open={openDialogs.payReceipt}
        onOpenChange={(open) =>
          setOpenDialogs((prev) => ({ ...prev, payReceipt: open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Confirme el pago de la boleta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment_method">Método de Pago *</Label>
              <Select
                value={paymentData.payment_method}
                onValueChange={(value) =>
                  setPaymentData((prev) => ({
                    ...prev,
                    payment_method: value
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethods).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_reference">Referencia del Pago</Label>
              <Input
                id="payment_reference"
                value={paymentData.payment_reference}
                onChange={(e) =>
                  setPaymentData((prev) => ({
                    ...prev,
                    payment_reference: e.target.value
                  }))
                }
                placeholder="Número de operación, voucher, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={payReceipt}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptsDashboard;
