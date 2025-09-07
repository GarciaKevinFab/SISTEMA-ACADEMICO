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
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Calendar,
  FileText,
  Download,
  Eye,
  Edit,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const HRDashboard = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDialogs, setOpenDialogs] = useState({
    newEmployee: false,
    editEmployee: false,
    newAttendance: false,
    viewEmployee: false
  });

  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    document_number: '',
    birth_date: '',
    email: '',
    phone: '',
    address: '',
    position: '',
    department: '',
    hire_date: '',
    contract_type: 'PERMANENT',
    salary: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const [newAttendance, setNewAttendance] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    break_minutes: '60',
    overtime_hours: '0',
    notes: ''
  });

  const contractTypes = {
    'PERMANENT': 'Nombrado/Permanente',
    'TEMPORARY': 'Contratado',
    'CAS': 'CAS',
    'LOCACION': 'Locación de Servicios'
  };

  const employeeStatuses = {
    'ACTIVE': { label: 'Activo', color: 'bg-green-500' },
    'INACTIVE': { label: 'Inactivo', color: 'bg-gray-500' },
    'SUSPENDED': { label: 'Suspendido', color: 'bg-yellow-500' },
    'RETIRED': { label: 'Cesante/Jubilado', color: 'bg-blue-500' },
    'TERMINATED': { label: 'Cesado', color: 'bg-red-500' }
  };

  const departments = [
    'Educación Inicial',
    'Educación Primaria',
    'Educación Física',
    'Administración',
    'Dirección',
    'Secretaría Académica',
    'Biblioteca',
    'Laboratorio',
    'Mantenimiento'
  ];

  useEffect(() => {
    fetchEmployees();
    fetchAttendance();
  }, []);

  const fetchEmployees = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/hr/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${backendUrl}/api/hr/attendance?date_from=${today}&date_to=${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAttendance(data.attendance || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const validateDNI = (dni) => {
    return dni && dni.length === 8 && /^\d+$/.test(dni);
  };

  const createEmployee = async () => {
    if (!validateDNI(newEmployee.document_number)) {
      toast({
        title: "Error",
        description: "El DNI debe tener 8 dígitos",
        variant: "destructive"
      });
      return;
    }

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const employeeData = {
        ...newEmployee,
        salary: parseFloat(newEmployee.salary) || 0
      };
      
      const response = await fetch(`${backendUrl}/api/hr/employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Éxito",
          description: `Empleado ${data.employee.employee_code} creado correctamente`
        });
        setOpenDialogs({ ...openDialogs, newEmployee: false });
        setNewEmployee({
          first_name: '',
          last_name: '',
          document_number: '',
          birth_date: '',
          email: '',
          phone: '',
          address: '',
          position: '',
          department: '',
          hire_date: '',
          contract_type: 'PERMANENT',
          salary: '',
          emergency_contact_name: '',
          emergency_contact_phone: ''
        });
        fetchEmployees();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo crear el empleado",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const createAttendance = async () => {
    if (!newAttendance.employee_id) {
      toast({
        title: "Error",
        description: "Seleccione un empleado",
        variant: "destructive"
      });
      return;
    }

    try {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      
      const attendanceData = {
        ...newAttendance,
        check_in: newAttendance.check_in ? `${newAttendance.date}T${newAttendance.check_in}:00` : null,
        check_out: newAttendance.check_out ? `${newAttendance.date}T${newAttendance.check_out}:00` : null,
        break_minutes: parseInt(newAttendance.break_minutes) || 0,
        overtime_hours: parseFloat(newAttendance.overtime_hours) || 0
      };
      
      const response = await fetch(`${backendUrl}/api/hr/attendance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attendanceData)
      });
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Asistencia registrada correctamente"
        });
        setOpenDialogs({ ...openDialogs, newAttendance: false });
        setNewAttendance({
          employee_id: '',
          date: new Date().toISOString().split('T')[0],
          check_in: '',
          check_out: '',
          break_minutes: '60',
          overtime_hours: '0',
          notes: ''
        });
        fetchAttendance();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo registrar la asistencia",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating attendance:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    }
  };

  const calculateWorkedHours = (checkIn, checkOut, breakMinutes = 0) => {
    if (!checkIn || !checkOut) return 0;
    
    const startTime = new Date(checkIn);
    const endTime = new Date(checkOut);
    const diffMs = endTime - startTime;
    const workedMinutes = (diffMs / 60000) - breakMinutes;
    
    return Math.max(0, workedMinutes / 60);
  };

  const isLate = (checkIn) => {
    if (!checkIn) return false;
    
    const checkInTime = new Date(checkIn);
    const expectedStart = new Date(checkIn);
    expectedStart.setHours(8, 0, 0, 0);
    
    return checkInTime > expectedStart;
  };

  const viewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setOpenDialogs({ ...openDialogs, viewEmployee: true });
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
            <CardTitle className="text-sm font-medium">Personal Activo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {employees.filter(e => e.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Presente Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {attendance.filter(a => !a.is_absent).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ausentes Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {attendance.filter(a => a.is_absent).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tardanzas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {attendance.filter(a => a.is_late).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Empleados</TabsTrigger>
          <TabsTrigger value="attendance">Asistencia</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Personal</CardTitle>
                <CardDescription>Registro y control de empleados</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newEmployee} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newEmployee: open })}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Empleado
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Empleado</DialogTitle>
                    <DialogDescription>
                      Complete los datos del nuevo empleado
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">Nombres *</Label>
                        <Input
                          id="first_name"
                          value={newEmployee.first_name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
                          placeholder="Juan Carlos"
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Apellidos *</Label>
                        <Input
                          id="last_name"
                          value={newEmployee.last_name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
                          placeholder="Pérez García"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="document_number">DNI *</Label>
                        <Input
                          id="document_number"
                          value={newEmployee.document_number}
                          onChange={(e) => setNewEmployee({ ...newEmployee, document_number: e.target.value })}
                          placeholder="12345678"
                          maxLength={8}
                        />
                      </div>
                      <div>
                        <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                        <Input
                          id="birth_date"
                          type="date"
                          value={newEmployee.birth_date}
                          onChange={(e) => setNewEmployee({ ...newEmployee, birth_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newEmployee.email}
                          onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                          placeholder="empleado@iespp.edu.pe"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={newEmployee.phone}
                          onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                          placeholder="987654321"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={newEmployee.address}
                        onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                        placeholder="Dirección completa"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="position">Cargo *</Label>
                        <Input
                          id="position"
                          value={newEmployee.position}
                          onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                          placeholder="Docente de Educación Inicial"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Departamento</Label>
                        <Select 
                          value={newEmployee.department} 
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, department: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="hire_date">Fecha de Ingreso</Label>
                        <Input
                          id="hire_date"
                          type="date"
                          value={newEmployee.hire_date}
                          onChange={(e) => setNewEmployee({ ...newEmployee, hire_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="contract_type">Tipo de Contrato</Label>
                        <Select 
                          value={newEmployee.contract_type} 
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, contract_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(contractTypes).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="salary">Salario</Label>
                        <Input
                          id="salary"
                          type="number"
                          step="0.01"
                          value={newEmployee.salary}
                          onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergency_contact_name">Contacto de Emergencia</Label>
                        <Input
                          id="emergency_contact_name"
                          value={newEmployee.emergency_contact_name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, emergency_contact_name: e.target.value })}
                          placeholder="María Pérez"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergency_contact_phone">Teléfono de Emergencia</Label>
                        <Input
                          id="emergency_contact_phone"
                          value={newEmployee.emergency_contact_phone}
                          onChange={(e) => setNewEmployee({ ...newEmployee, emergency_contact_phone: e.target.value })}
                          placeholder="987654321"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createEmployee}
                      disabled={!newEmployee.first_name || !newEmployee.last_name || !newEmployee.document_number || !newEmployee.position}
                    >
                      Crear Empleado
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                {employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay empleados registrados
                  </div>
                ) : (
                  employees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <Users className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-gray-600">{employee.position}</p>
                          <p className="text-xs text-gray-500">
                            {employee.employee_code} - {employee.department}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{contractTypes[employee.contract_type]}</p>
                          <p className="text-xs text-gray-500">
                            Ingreso: {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        
                        <Badge className={`${employeeStatuses[employee.status].color} text-white`}>
                          {employeeStatuses[employee.status].label}
                        </Badge>

                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => viewEmployee(employee)}
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

        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Control de Asistencia</CardTitle>
                <CardDescription>Registro de entrada y salida del personal</CardDescription>
              </div>
              <Dialog 
                open={openDialogs.newAttendance} 
                onOpenChange={(open) => setOpenDialogs({ ...openDialogs, newAttendance: open })}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Asistencia
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Asistencia</DialogTitle>
                    <DialogDescription>
                      Complete los datos de asistencia del empleado
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="employee_select">Empleado *</Label>
                      <Select 
                        value={newAttendance.employee_id} 
                        onValueChange={(value) => setNewAttendance({ ...newAttendance, employee_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empleado" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.filter(e => e.status === 'ACTIVE').map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.first_name} {employee.last_name} - {employee.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="attendance_date">Fecha *</Label>
                      <Input
                        id="attendance_date"
                        type="date"
                        value={newAttendance.date}
                        onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="check_in">Hora de Entrada</Label>
                        <Input
                          id="check_in"
                          type="time"
                          value={newAttendance.check_in}
                          onChange={(e) => setNewAttendance({ ...newAttendance, check_in: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="check_out">Hora de Salida</Label>
                        <Input
                          id="check_out"
                          type="time"
                          value={newAttendance.check_out}
                          onChange={(e) => setNewAttendance({ ...newAttendance, check_out: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="break_minutes">Minutos de Descanso</Label>
                        <Input
                          id="break_minutes"
                          type="number"
                          value={newAttendance.break_minutes}
                          onChange={(e) => setNewAttendance({ ...newAttendance, break_minutes: e.target.value })}
                          placeholder="60"
                        />
                      </div>
                      <div>
                        <Label htmlFor="overtime_hours">Horas Extra</Label>
                        <Input
                          id="overtime_hours"
                          type="number"
                          step="0.5"
                          value={newAttendance.overtime_hours}
                          onChange={(e) => setNewAttendance({ ...newAttendance, overtime_hours: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="attendance_notes">Observaciones</Label>
                      <Textarea
                        id="attendance_notes"
                        value={newAttendance.notes}
                        onChange={(e) => setNewAttendance({ ...newAttendance, notes: e.target.value })}
                        placeholder="Observaciones sobre la asistencia"
                      />
                    </div>
                    
                    {newAttendance.check_in && newAttendance.check_out && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">
                          Horas trabajadas: {calculateWorkedHours(
                            `${newAttendance.date}T${newAttendance.check_in}:00`,
                            `${newAttendance.date}T${newAttendance.check_out}:00`,
                            parseInt(newAttendance.break_minutes)
                          ).toFixed(2)}h
                        </p>
                        {isLate(`${newAttendance.date}T${newAttendance.check_in}:00`) && (
                          <p className="text-sm text-yellow-600 mt-1">
                            ⚠️ Tardanza registrada
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createAttendance}
                      disabled={!newAttendance.employee_id}
                    >
                      Registrar Asistencia
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                {attendance.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay registros de asistencia para hoy
                  </div>
                ) : (
                  attendance.map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {record.is_absent ? (
                          <UserX className="h-8 w-8 text-red-500" />
                        ) : (
                          <UserCheck className="h-8 w-8 text-green-500" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {record.employee?.first_name} {record.employee?.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{record.employee?.position}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {record.is_absent ? (
                          <Badge variant="destructive">Ausente</Badge>
                        ) : (
                          <div>
                            <p className="text-sm font-medium">
                              {record.check_in ? new Date(record.check_in).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--:--'} - 
                              {record.check_out ? new Date(record.check_out).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {record.worked_hours ? `${record.worked_hours.toFixed(2)}h trabajadas` : 'Horario incompleto'}
                            </p>
                            {record.is_late && (
                              <Badge variant="destructive" className="mt-1">
                                Tardanza
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Contratos</CardTitle>
              <CardDescription>Contratos y vinculación laboral</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Próximamente</h3>
                <p>La gestión de contratos estará disponible próximamente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de RRHH</CardTitle>
              <CardDescription>Análisis y exportaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Asistencia Mensual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Reporte de asistencia del mes
                    </p>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nómina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Planilla de sueldos
                    </p>
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Excel
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Activo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Lista de personal activo
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

      {/* View Employee Dialog */}
      <Dialog 
        open={openDialogs.viewEmployee} 
        onOpenChange={(open) => setOpenDialogs({ ...openDialogs, viewEmployee: open })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Empleado</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.employee_code}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Información Personal</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Nombre:</strong> {selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                    <p><strong>DNI:</strong> {selectedEmployee.document_number}</p>
                    <p><strong>Fecha de Nacimiento:</strong> {
                      selectedEmployee.birth_date ? 
                      new Date(selectedEmployee.birth_date).toLocaleDateString() : 
                      'No especificada'
                    }</p>
                    <p><strong>Email:</strong> {selectedEmployee.email || 'No especificado'}</p>
                    <p><strong>Teléfono:</strong> {selectedEmployee.phone || 'No especificado'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium">Información Laboral</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Cargo:</strong> {selectedEmployee.position}</p>
                    <p><strong>Departamento:</strong> {selectedEmployee.department}</p>
                    <p><strong>Fecha de Ingreso:</strong> {
                      selectedEmployee.hire_date ? 
                      new Date(selectedEmployee.hire_date).toLocaleDateString() : 
                      'No especificada'
                    }</p>
                    <p><strong>Tipo de Contrato:</strong> {contractTypes[selectedEmployee.contract_type]}</p>
                    <p><strong>Estado:</strong> 
                      <Badge className={`ml-2 ${employeeStatuses[selectedEmployee.status].color} text-white`}>
                        {employeeStatuses[selectedEmployee.status].label}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {(selectedEmployee.emergency_contact_name || selectedEmployee.emergency_contact_phone) && (
                <div>
                  <h4 className="font-medium">Contacto de Emergencia</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Nombre:</strong> {selectedEmployee.emergency_contact_name || 'No especificado'}</p>
                    <p><strong>Teléfono:</strong> {selectedEmployee.emergency_contact_phone || 'No especificado'}</p>
                  </div>
                </div>
              )}

              {selectedEmployee.address && (
                <div>
                  <h4 className="font-medium">Dirección</h4>
                  <p className="mt-2 text-sm">{selectedEmployee.address}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Generar CV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRDashboard;