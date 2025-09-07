import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../../hooks/use-toast';
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  CheckCircle,
  Upload,
  Download,
  RefreshCw
} from 'lucide-react';

const CashBanksDashboard = () => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState(null);
  const [cashMovements, setCashMovements] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialogs, setOpenDialogs] = useState({
    newMovement: false,
    closeSession: false,
    newBankAccount: false,
    reconciliation: false
  });

  const [newMovement, setNewMovement] = useState({
    movement_type: 'INCOME',
    amount: '',
    concept: '',
    description: '',
    cost_center: ''
  });

  const [sessionClose, setSessionClose] = useState({
    final_amount: '',
    closing_notes: ''
  });

  const [newBankAccount, setNewBankAccount] = useState({
    account_name: '',
    bank_name: '',
    account_number: '',
    account_type: 'CHECKING',
    currency: 'PEN'
  });

  useEffect(() => {
    fetchCurrentSession();
    fetchBankAccounts();
  }, []);

  const fetchCurrentSession = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/cash-sessions/current`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        setCashMovements(data.movements || []);
      }
    } catch (error) {
      console.error('Error fetching current session:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la sesión actual",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/bank-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const openCashSession = async () => {
    const initialAmount = prompt('Ingrese el monto inicial de caja:');
    if (!initialAmount) return;

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/cash-sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initial_amount: parseFloat(initialAmount),
          cashier_notes: 'Sesión abierta desde dashboard'
        })
      });
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Sesión de caja abierta correctamente"
        });
        fetchCurrentSession();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo abrir la sesión",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error opening cash session:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const createCashMovement = async () => {
    if (!currentSession) {
      toast({
        title: "Error",
        description: "No hay una sesión de caja abierta",
        variant: "destructive"
      });
      return;
    }

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/cash-movements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newMovement,
          cash_session_id: currentSession.id,
          amount: parseFloat(newMovement.amount)
        })
      });
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Movimiento registrado correctamente"
        });
        setOpenDialogs({ ...openDialogs, newMovement: false });
        setNewMovement({
          movement_type: 'INCOME',
          amount: '',
          concept: '',
          description: '',
          cost_center: ''
        });
        fetchCurrentSession();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo registrar el movimiento",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating cash movement:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const closeCashSession = async () => {
    if (!currentSession) return;

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/cash-sessions/${currentSession.id}/close?final_amount=${sessionClose.final_amount}&closing_notes=${encodeURIComponent(sessionClose.closing_notes)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Sesión de caja cerrada correctamente"
        });
        setOpenDialogs({ ...openDialogs, closeSession: false });
        setCurrentSession(null);
        setCashMovements([]);
        setSessionClose({ final_amount: '', closing_notes: '' });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo cerrar la sesión",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error closing cash session:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const createBankAccount = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/finance/bank-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newBankAccount)
      });
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Cuenta bancaria creada correctamente"
        });
        setOpenDialogs({ ...openDialogs, newBankAccount: false });
        setNewBankAccount({
          account_name: '',
          bank_name: '',
          account_number: '',
          account_type: 'CHECKING',
          currency: 'PEN'
        });
        fetchBankAccounts();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear la cuenta",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating bank account:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
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
    <div className="space-y-6">
      {/* Cash Session Status */}
      <Card className={`border-l-4 ${currentSession ? 'border-l-green-500' : 'border-l-gray-400'}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Estado de Caja</span>
            </CardTitle>
            <CardDescription>
              {currentSession ? 'Sesión activa' : 'Sin sesión activa'}
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            {!currentSession ? (
              <Button onClick={openCashSession}>Abrir Caja</Button>
            ) : (
              <Dialog 
                open={openDialogs.closeSession} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, closeSession: open })}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Cerrar Caja</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cerrar Sesión de Caja</DialogTitle>
                    <DialogDescription>
                      Ingrese el monto físico contado para el arqueo de caja
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Monto Esperado: S/. {currentSession?.expected_final_amount?.toFixed(2) || '0.00'}</Label>
                    </div>
                    <div>
                      <Label htmlFor="final_amount">Monto Físico Contado *</Label>
                      <Input
                        id="final_amount"
                        type="number"
                        step="0.01"
                        value={sessionClose.final_amount}
                        onChange={(e) => setSessionClose({ ...sessionClose, final_amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="closing_notes">Observaciones</Label>
                      <Textarea
                        id="closing_notes"
                        value={sessionClose.closing_notes}
                        onChange={(e) => setSessionClose({ ...sessionClose, closing_notes: e.target.value })}
                        placeholder="Observaciones del arqueo de caja..."
                      />
                    </div>
                    {sessionClose.final_amount && currentSession?.expected_final_amount && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm font-medium">
                          Diferencia: S/. {(parseFloat(sessionClose.final_amount) - currentSession.expected_final_amount).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={closeCashSession}
                      disabled={!sessionClose.final_amount}
                    >
                      Cerrar Sesión
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        {currentSession && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Sesión</p>
                <p className="font-semibold">{currentSession.session_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monto Inicial</p>
                <p className="font-semibold">S/. {currentSession.initial_amount?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="font-semibold text-green-600">S/. {currentSession.total_income?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Saldo Esperado</p>
                <p className="font-semibold">S/. {currentSession.expected_final_amount?.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movimientos de Caja</TabsTrigger>
          <TabsTrigger value="banks">Cuentas Bancarias</TabsTrigger>
          <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Movimientos de Caja</CardTitle>
                <CardDescription>Registro de ingresos y egresos</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newMovement} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newMovement: open })}
              >
                <DialogTrigger asChild>
                  <Button disabled={!currentSession}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Movimiento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Movimiento</DialogTitle>
                    <DialogDescription>
                      Registre un ingreso o egreso de caja
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
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
                          <SelectItem value="INCOME">Ingreso</SelectItem>
                          <SelectItem value="EXPENSE">Egreso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount">Monto *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newMovement.amount}
                        onChange={(e) => setNewMovement({ ...newMovement, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="concept">Concepto *</Label>
                      <Input
                        id="concept"
                        value={newMovement.concept}
                        onChange={(e) => setNewMovement({ ...newMovement, concept: e.target.value })}
                        placeholder="Concepto del movimiento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={newMovement.description}
                        onChange={(e) => setNewMovement({ ...newMovement, description: e.target.value })}
                        placeholder="Descripción detallada..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="cost_center">Centro de Costo</Label>
                      <Input
                        id="cost_center"
                        value={newMovement.cost_center}
                        onChange={(e) => setNewMovement({ ...newMovement, cost_center: e.target.value })}
                        placeholder="CC001"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createCashMovement}
                      disabled={!newMovement.amount || !newMovement.concept}
                    >
                      Registrar Movimiento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cashMovements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay movimientos registrados
                  </div>
                ) : (
                  cashMovements.map((movement, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {movement.movement_type === 'INCOME' ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{movement.concept}</p>
                          <p className="text-sm text-gray-600">{movement.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${movement.movement_type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.movement_type === 'INCOME' ? '+' : '-'}S/. {movement.amount?.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{movement.movement_number}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cuentas Bancarias</CardTitle>
                <CardDescription>Gestión de cuentas bancarias</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newBankAccount} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newBankAccount: open })}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Cuenta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Cuenta Bancaria</DialogTitle>
                    <DialogDescription>
                      Agregue una nueva cuenta bancaria
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="account_name">Nombre de Cuenta *</Label>
                      <Input
                        id="account_name"
                        value={newBankAccount.account_name}
                        onChange={(e) => setNewBankAccount({ ...newBankAccount, account_name: e.target.value })}
                        placeholder="Cuenta Corriente Principal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank_name">Banco *</Label>
                      <Input
                        id="bank_name"
                        value={newBankAccount.bank_name}
                        onChange={(e) => setNewBankAccount({ ...newBankAccount, bank_name: e.target.value })}
                        placeholder="Banco de la Nación"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_number">Número de Cuenta *</Label>
                      <Input
                        id="account_number"
                        value={newBankAccount.account_number}
                        onChange={(e) => setNewBankAccount({ ...newBankAccount, account_number: e.target.value })}
                        placeholder="00123456789012345678"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_type">Tipo de Cuenta *</Label>
                      <Select 
                        value={newBankAccount.account_type} 
                        onValueChange={(value) => setNewBankAccount({ ...newBankAccount, account_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHECKING">Corriente</SelectItem>
                          <SelectItem value="SAVINGS">Ahorros</SelectItem>
                          <SelectItem value="CTS">CTS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="currency">Moneda</Label>
                      <Select 
                        value={newBankAccount.currency} 
                        onValueChange={(value) => setNewBankAccount({ ...newBankAccount, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PEN">Soles (S/.)</SelectItem>
                          <SelectItem value="USD">Dólares ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createBankAccount}
                      disabled={!newBankAccount.account_name || !newBankAccount.bank_name || !newBankAccount.account_number}
                    >
                      Crear Cuenta
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay cuentas bancarias registradas
                  </div>
                ) : (
                  bankAccounts.map((account, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{account.account_name}</p>
                          <p className="text-sm text-gray-600">{account.bank_name}</p>
                          <p className="text-xs text-gray-500">**** {account.account_number?.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-1">{account.account_type}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Conciliación Bancaria</CardTitle>
              <CardDescription>Subir extractos bancarios para conciliación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Subir Extracto Bancario</h3>
                <p className="text-gray-600 mb-4">
                  Sube archivos CSV o Excel con los movimientos bancarios
                </p>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CashBanksDashboard;