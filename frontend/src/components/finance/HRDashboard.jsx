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
import { toast } from "../../utils/safeToast";
import { Logistics } from "../../services/finance.service";

import {
  Plus,
  Users,
  UserCheck,
  UserX,
  Eye,
  Edit,
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Printer,
  FileSpreadsheet,
  FileSignature,
  CalendarDays,
} from "lucide-react";

const HRDashboard = () => {
  const { user } = useContext(AuthContext);

  // =========================
  // STATE
  // =========================
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]); // hoy
  const [contracts, setContracts] = useState([]);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);

  const [loading, setLoading] = useState(true);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [openDialogs, setOpenDialogs] = useState({
    newEmployee: false,
    editEmployee: false,
    newAttendance: false,
    viewEmployee: false,

    newContract: false,
    editContract: false,
    viewContract: false,

    reportPreview: false,
  });

  const [newEmployee, setNewEmployee] = useState({
    first_name: "",
    last_name: "",
    document_number: "",
    birth_date: "",
    email: "",
    phone: "",
    address: "",
    position: "",
    department: "",
    hire_date: "",
    contract_type: "PERMANENT",
    salary: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [newAttendance, setNewAttendance] = useState({
    employee_id: "",
    date: new Date().toISOString().split("T")[0],
    check_in: "",
    check_out: "",
    break_minutes: "60",
    overtime_hours: "0",
    notes: "",
  });

  const [contractForm, setContractForm] = useState({
    id: null,
    employee_id: "",
    contract_type: "PERMANENT",
    start_date: "",
    end_date: "",
    salary: "",
    status: "ACTIVE", // ACTIVE | EXPIRED | TERMINATED
    notes: "",
    document_url: "",
  });

  // contratos: filtros
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("ALL");

  // reportes
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [reportRange, setReportRange] = useState({
    date_from: todayISO,
    date_to: todayISO,
  });
  const [reportPreview, setReportPreview] = useState({
    title: "",
    columns: [],
    rows: [],
    footer: "",
  });

  // =========================
  // CONSTANTS
  // =========================
  const contractTypes = {
    PERMANENT: "Nombrado/Permanente",
    TEMPORARY: "Contratado",
    CAS: "CAS",
    LOCACION: "Locación de Servicios",
  };

  const employeeStatuses = {
    ACTIVE: { label: "Activo", color: "bg-green-500" },
    INACTIVE: { label: "Inactivo", color: "bg-gray-500" },
    SUSPENDED: { label: "Suspendido", color: "bg-yellow-500" },
    RETIRED: { label: "Cesante/Jubilado", color: "bg-blue-500" },
    TERMINATED: { label: "Cesado", color: "bg-red-500" },
  };

  const contractStatuses = {
    ACTIVE: { label: "Vigente", color: "bg-green-600" },
    EXPIRED: { label: "Vencido", color: "bg-yellow-600" },
    TERMINATED: { label: "Terminado", color: "bg-red-600" },
  };

  const departments = [
    "Educación Inicial",
    "Educación Primaria",
    "Educación Física",
    "Administración",
    "Dirección",
    "Secretaría Académica",
    "Biblioteca",
    "Laboratorio",
    "Mantenimiento",
  ];

  // =========================
  // HELPERS
  // =========================
  const safeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (value) => {
    const d = safeDate(value);
    return d ? d.toLocaleDateString("es-PE") : "N/A";
  };

  const formatMoney = (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(num)) return "S/ 0.00";
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(num);
  };

  const normalizeList = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      for (const k of keys) {
        if (Array.isArray(data[k])) return data[k];
      }
      if (Array.isArray(data.results)) return data.results;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.data)) return data.data;
    }
    return [];
  };

  const errorToText = (error) => {
    const data = error?.response?.data;

    if (typeof data === "string") return data;
    if (typeof data?.detail === "string") return data.detail;

    if (data && typeof data === "object") {
      const parts = Object.entries(data).map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
        if (typeof v === "string") return `${k}: ${v}`;
        return `${k}: ${JSON.stringify(v)}`;
      });
      if (parts.length) return parts.join(" • ");
    }

    if (typeof error?.message === "string") return error.message;
    return "Ocurrió un error inesperado";
  };

  const validateDNI = (dni) => dni && dni.length === 8 && /^\d+$/.test(dni);

  const exportCSV = (filename, columns, rows) => {
    const esc = (v) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };

    const header = columns.map(esc).join(",");
    const body = rows.map((r) => r.map(esc).join(",")).join("\n");
    const csv = `${header}\n${body}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPrintWindow = ({ title, columns, rows, footer }) => {
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        .meta { font-size: 12px; color: #444; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f5f5f5; }
        .footer { margin-top: 12px; font-size: 12px; color: #333; }
      </style>
    `;

    const table = `
      <table>
        <thead>
          <tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
        .map((r) => `<tr>${r.map((v) => `<td>${String(v ?? "")}</td>`).join("")}</tr>`)
        .join("")}
        </tbody>
      </table>
    `;

    const w = window.open("", "_blank");
    if (!w) {
      toast({ title: "Error", description: "El navegador bloqueó la ventana de impresión.", variant: "destructive" });
      return;
    }

    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>${title}</title>
          ${style}
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Generado: ${new Date().toLocaleString("es-PE")} • Usuario: ${user?.email || "—"}</div>
          ${table}
          ${footer ? `<div class="footer">${footer}</div>` : ""}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  const calcContractStatus = (c) => {
    if (c?.status) return c.status;
    // si no hay status, inferimos por end_date
    const end = safeDate(c?.end_date);
    if (end && end < new Date()) return "EXPIRED";
    return "ACTIVE";
  };

  const employeeById = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => map.set(String(e.id), e));
    return map;
  }, [employees]);

  // =========================
  // API (EMPLOYEES / ATTENDANCE / CONTRACTS)
  // =========================
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchEmployees(), fetchAttendanceToday()]);
      await fetchContracts(); // contratos también
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await Logistics.employees();
      setEmployees(normalizeList(data, ["employees"]));
    } catch (error) {
      console.error("Error fetching employees:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error) || "No se pudo cargar empleados", variant: "destructive" });
      setEmployees([]);
    }
  };

  const fetchAttendanceToday = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await Logistics.attendance({ date_from: today, date_to: today });
      setAttendance(normalizeList(data, ["attendance"]));
    } catch (error) {
      console.error("Error fetching attendance:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error) || "No se pudo cargar asistencia", variant: "destructive" });
      setAttendance([]);
    }
  };

  const fetchAttendanceRange = async (date_from, date_to) => {
    try {
      const data = await Logistics.attendance({ date_from, date_to });
      return normalizeList(data, ["attendance"]);
    } catch (error) {
      console.error("Error fetching attendance range:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error) || "No se pudo cargar asistencia", variant: "destructive" });
      return [];
    }
  };

  const fetchContracts = async () => {
    setContractsLoading(true);
    try {
      // Si existe backend, úsalo
      if (typeof Logistics.contracts === "function") {
        const data = await Logistics.contracts();
        setContracts(normalizeList(data, ["contracts"]));
      } else {
        // Modo local: generamos contratos base desde empleados
        const local = employees.map((e) => ({
          id: `local-${e.id}`,
          employee_id: e.id,
          contract_type: e.contract_type || "PERMANENT",
          start_date: e.hire_date || "",
          end_date: "",
          salary: e.salary ?? "",
          status: "ACTIVE",
          notes: "",
          document_url: "",
        }));
        setContracts(local);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error) || "No se pudo cargar contratos", variant: "destructive" });
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // =========================
  // EMPLOYEE CRUD
  // =========================
  const createEmployee = async () => {
    if (!validateDNI(newEmployee.document_number)) {
      toast({ title: "Error", description: "El DNI debe tener 8 dígitos", variant: "destructive" });
      return;
    }

    try {
      const payload = { ...newEmployee, salary: parseFloat(newEmployee.salary) || 0 };
      const data = await Logistics.createEmployee(payload);
      const emp = data?.employee || data?.item || data;

      toast({ title: "Éxito", description: `Empleado ${emp?.employee_code || ""} creado correctamente` });

      setOpenDialogs((p) => ({ ...p, newEmployee: false }));
      setNewEmployee({
        first_name: "",
        last_name: "",
        document_number: "",
        birth_date: "",
        email: "",
        phone: "",
        address: "",
        position: "",
        department: "",
        hire_date: "",
        contract_type: "PERMANENT",
        salary: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });

      await fetchEmployees();
      await fetchContracts();
    } catch (error) {
      console.error("Error creating employee:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error), variant: "destructive" });
    }
  };

  // =========================
  // ATTENDANCE CRUD
  // =========================
  const calculateWorkedHours = (checkIn, checkOut, breakMinutes = 0) => {
    if (!checkIn || !checkOut) return 0;
    const startTime = safeDate(checkIn);
    const endTime = safeDate(checkOut);
    if (!startTime || !endTime) return 0;
    const diffMs = endTime - startTime;
    const workedMinutes = diffMs / 60000 - (breakMinutes || 0);
    return Math.max(0, workedMinutes / 60);
  };

  const isLate = (checkIn) => {
    if (!checkIn) return false;
    const checkInTime = safeDate(checkIn);
    if (!checkInTime) return false;
    const expectedStart = new Date(checkInTime);
    expectedStart.setHours(8, 0, 0, 0);
    return checkInTime > expectedStart;
  };

  const createAttendance = async () => {
    if (!newAttendance.employee_id) {
      toast({ title: "Error", description: "Seleccione un empleado", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        ...newAttendance,
        employee_id: parseInt(newAttendance.employee_id, 10),
        check_in: newAttendance.check_in ? `${newAttendance.date}T${newAttendance.check_in}:00` : null,
        check_out: newAttendance.check_out ? `${newAttendance.date}T${newAttendance.check_out}:00` : null,
        break_minutes: parseInt(newAttendance.break_minutes, 10) || 0,
        overtime_hours: parseFloat(newAttendance.overtime_hours) || 0,
      };

      await Logistics.createAttendance(payload);

      toast({ title: "Éxito", description: "Asistencia registrada correctamente" });
      setOpenDialogs((p) => ({ ...p, newAttendance: false }));
      setNewAttendance({
        employee_id: "",
        date: new Date().toISOString().split("T")[0],
        check_in: "",
        check_out: "",
        break_minutes: "60",
        overtime_hours: "0",
        notes: "",
      });

      await fetchAttendanceToday();
    } catch (error) {
      console.error("Error creating attendance:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error), variant: "destructive" });
    }
  };

  // =========================
  // CONTRACTS CRUD
  // =========================
  const resetContractForm = () => {
    setContractForm({
      id: null,
      employee_id: "",
      contract_type: "PERMANENT",
      start_date: "",
      end_date: "",
      salary: "",
      status: "ACTIVE",
      notes: "",
      document_url: "",
    });
  };

  const openNewContract = () => {
    resetContractForm();
    setOpenDialogs((p) => ({ ...p, newContract: true }));
  };

  const openViewContract = (c) => {
    setSelectedContract(c);
    setOpenDialogs((p) => ({ ...p, viewContract: true }));
  };

  const openEditContract = (c) => {
    setContractForm({
      id: c.id ?? null,
      employee_id: String(c.employee_id ?? ""),
      contract_type: c.contract_type ?? "PERMANENT",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      salary: c.salary ?? "",
      status: calcContractStatus(c),
      notes: c.notes ?? "",
      document_url: c.document_url ?? c.documentUrl ?? "",
    });
    setSelectedContract(c);
    setOpenDialogs((p) => ({ ...p, editContract: true }));
  };

  const createContract = async () => {
    if (!contractForm.employee_id) {
      toast({ title: "Error", description: "Seleccione un empleado", variant: "destructive" });
      return;
    }
    if (!contractForm.start_date) {
      toast({ title: "Error", description: "Ingrese fecha de inicio", variant: "destructive" });
      return;
    }

    const payload = {
      employee_id: parseInt(contractForm.employee_id, 10),
      contract_type: contractForm.contract_type,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      salary: parseFloat(contractForm.salary) || 0,
      status: contractForm.status,
      notes: contractForm.notes || "",
      document_url: contractForm.document_url || "",
    };

    try {
      if (typeof Logistics.createContract === "function") {
        await Logistics.createContract(payload);
        toast({ title: "Éxito", description: "Contrato creado correctamente" });
        setOpenDialogs((p) => ({ ...p, newContract: false }));
        resetContractForm();
        await fetchContracts();
      } else {
        // modo local
        const local = {
          ...payload,
          id: `local-${Date.now()}`,
        };
        setContracts((prev) => [local, ...prev]);
        toast({
          title: "OK",
          description: "Contrato creado (modo local). Implementa Logistics.createContract para guardarlo en backend.",
        });
        setOpenDialogs((p) => ({ ...p, newContract: false }));
        resetContractForm();
      }
    } catch (error) {
      console.error("Error creating contract:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error), variant: "destructive" });
    }
  };

  const updateContract = async () => {
    if (!contractForm.id) {
      toast({ title: "Error", description: "No hay contrato seleccionado", variant: "destructive" });
      return;
    }

    const payload = {
      id: contractForm.id,
      employee_id: parseInt(contractForm.employee_id, 10),
      contract_type: contractForm.contract_type,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      salary: parseFloat(contractForm.salary) || 0,
      status: contractForm.status,
      notes: contractForm.notes || "",
      document_url: contractForm.document_url || "",
    };

    try {
      if (typeof Logistics.updateContract === "function") {
        await Logistics.updateContract(payload.id, payload);
        toast({ title: "Éxito", description: "Contrato actualizado correctamente" });
        setOpenDialogs((p) => ({ ...p, editContract: false }));
        resetContractForm();
        await fetchContracts();
      } else {
        // modo local
        setContracts((prev) => prev.map((c) => (String(c.id) === String(payload.id) ? { ...c, ...payload } : c)));
        toast({
          title: "OK",
          description: "Contrato actualizado (modo local). Implementa Logistics.updateContract para backend.",
        });
        setOpenDialogs((p) => ({ ...p, editContract: false }));
        resetContractForm();
      }
    } catch (error) {
      console.error("Error updating contract:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error), variant: "destructive" });
    }
  };

  const terminateContract = async (c) => {
    const id = c?.id;
    if (!id) return;

    const endDate = new Date().toISOString().split("T")[0];

    try {
      if (typeof Logistics.terminateContract === "function") {
        await Logistics.terminateContract(id, { status: "TERMINATED", end_date: endDate });
        toast({ title: "Éxito", description: "Contrato terminado" });
        await fetchContracts();
      } else {
        setContracts((prev) =>
          prev.map((x) =>
            String(x.id) === String(id)
              ? { ...x, status: "TERMINATED", end_date: endDate }
              : x
          )
        );
        toast({
          title: "OK",
          description: "Contrato terminado (modo local). Implementa Logistics.terminateContract para backend.",
        });
      }
    } catch (error) {
      console.error("Error terminating contract:", error?.response?.data || error);
      toast({ title: "Error", description: errorToText(error), variant: "destructive" });
    }
  };

  // =========================
  // REPORTS
  // =========================
  const buildPayrollRows = () => {
    const rows = employees.map((e) => {
      const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      return [
        e.employee_code || "",
        fullName,
        e.document_number || "",
        e.department || "",
        e.position || "",
        contractTypes[e.contract_type] || e.contract_type || "",
        formatMoney(e.salary ?? 0),
        e.status || "",
      ];
    });

    const total = employees.reduce((acc, e) => acc + (parseFloat(e.salary) || 0), 0);
    return { rows, total };
  };

  const exportPayrollCSV = () => {
    const cols = ["Código", "Nombre", "DNI", "Departamento", "Cargo", "Contrato", "Salario", "Estado"];
    const { rows, total } = buildPayrollRows();
    exportCSV(`planilla_${new Date().toISOString().slice(0, 10)}`, cols, rows);
    toast({ title: "OK", description: `Planilla exportada. Total: ${formatMoney(total)}` });
  };

  const exportActiveEmployeesCSV = () => {
    const active = employees.filter((e) => e.status === "ACTIVE");
    const cols = ["Código", "Nombre", "DNI", "Departamento", "Cargo", "Contrato", "Salario"];
    const rows = active.map((e) => {
      const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      return [
        e.employee_code || "",
        fullName,
        e.document_number || "",
        e.department || "",
        e.position || "",
        contractTypes[e.contract_type] || e.contract_type || "",
        formatMoney(e.salary ?? 0),
      ];
    });
    exportCSV(`personal_activo_${new Date().toISOString().slice(0, 10)}`, cols, rows);
    toast({ title: "OK", description: `Exportado ${active.length} empleados activos` });
  };

  const exportAttendanceCSV = async () => {
    const { date_from, date_to } = reportRange;
    if (!date_from || !date_to) {
      toast({ title: "Error", description: "Define el rango de fechas", variant: "destructive" });
      return;
    }
    const data = await fetchAttendanceRange(date_from, date_to);
    const cols = ["Fecha", "Código", "Nombre", "Cargo", "Entrada", "Salida", "Horas", "Tardanza", "Ausente", "Notas"];
    const rows = data.map((r) => {
      const emp = r.employee || employeeById.get(String(r.employee_id)) || {};
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
      const inTime = safeDate(r.check_in)
        ? safeDate(r.check_in).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
        : "";
      const outTime = safeDate(r.check_out)
        ? safeDate(r.check_out).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
        : "";

      return [
        formatDate(r.date),
        emp.employee_code || "",
        fullName,
        emp.position || "",
        inTime,
        outTime,
        typeof r.worked_hours === "number" ? r.worked_hours.toFixed(2) : "",
        r.is_late ? "SI" : "NO",
        r.is_absent ? "SI" : "NO",
        r.notes || "",
      ];
    });

    exportCSV(`asistencia_${date_from}_a_${date_to}`, cols, rows);
    toast({ title: "OK", description: `Asistencia exportada (${rows.length} filas)` });
  };

  const previewReport = async (type) => {
    if (type === "payroll") {
      const cols = ["Código", "Nombre", "DNI", "Departamento", "Cargo", "Contrato", "Salario", "Estado"];
      const { rows, total } = buildPayrollRows();

      setReportPreview({
        title: "Reporte: Planilla",
        columns: cols,
        rows,
        footer: `Total planilla: ${formatMoney(total)}`,
      });
      setOpenDialogs((p) => ({ ...p, reportPreview: true }));
      return;
    }

    if (type === "active") {
      const active = employees.filter((e) => e.status === "ACTIVE");
      const cols = ["Código", "Nombre", "DNI", "Departamento", "Cargo", "Contrato", "Salario"];
      const rows = active.map((e) => {
        const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
        return [
          e.employee_code || "",
          fullName,
          e.document_number || "",
          e.department || "",
          e.position || "",
          contractTypes[e.contract_type] || e.contract_type || "",
          formatMoney(e.salary ?? 0),
        ];
      });

      setReportPreview({
        title: "Reporte: Personal Activo",
        columns: cols,
        rows,
        footer: `Total activos: ${active.length}`,
      });
      setOpenDialogs((p) => ({ ...p, reportPreview: true }));
      return;
    }

    if (type === "attendance") {
      const { date_from, date_to } = reportRange;
      const data = await fetchAttendanceRange(date_from, date_to);

      const cols = ["Fecha", "Código", "Nombre", "Cargo", "Entrada", "Salida", "Horas", "Tardanza", "Ausente"];
      const rows = data.map((r) => {
        const emp = r.employee || employeeById.get(String(r.employee_id)) || {};
        const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
        const inTime = safeDate(r.check_in)
          ? safeDate(r.check_in).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
          : "--:--";
        const outTime = safeDate(r.check_out)
          ? safeDate(r.check_out).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
          : "--:--";

        return [
          formatDate(r.date),
          emp.employee_code || "",
          fullName,
          emp.position || "",
          inTime,
          outTime,
          typeof r.worked_hours === "number" ? r.worked_hours.toFixed(2) : "",
          r.is_late ? "SI" : "NO",
          r.is_absent ? "SI" : "NO",
        ];
      });

      const absentCount = data.filter((x) => x.is_absent).length;
      const lateCount = data.filter((x) => x.is_late).length;

      setReportPreview({
        title: `Reporte: Asistencia (${date_from} a ${date_to})`,
        columns: cols,
        rows,
        footer: `Registros: ${rows.length} • Ausentes: ${absentCount} • Tardanzas: ${lateCount}`,
      });
      setOpenDialogs((p) => ({ ...p, reportPreview: true }));
    }
  };

  // =========================
  // FILTERED CONTRACTS
  // =========================
  const filteredContracts = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    return contracts
      .map((c) => ({ ...c, status: calcContractStatus(c) }))
      .filter((c) => {
        if (contractStatusFilter !== "ALL" && c.status !== contractStatusFilter) return false;

        if (!q) return true;

        const emp = employeeById.get(String(c.employee_id)) || {};
        const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim().toLowerCase();
        const code = String(emp.employee_code || "").toLowerCase();
        const dni = String(emp.document_number || "").toLowerCase();
        const type = String(c.contract_type || "").toLowerCase();
        return name.includes(q) || code.includes(q) || dni.includes(q) || type.includes(q);
      });
  }, [contracts, contractSearch, contractStatusFilter, employeeById]);

  // =========================
  // VIEW EMPLOYEE
  // =========================
  const viewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setOpenDialogs((p) => ({ ...p, viewEmployee: true }));
  };

  // =========================
  // RENDER (LOADING)
  // =========================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // =========================
  // UI
  // =========================
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
              {employees.filter((e) => e?.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Presente Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {attendance.filter((a) => !a?.is_absent).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ausentes Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {attendance.filter((a) => a?.is_absent).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tardanzas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {attendance.filter((a) => a?.is_late).length}
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

        {/* ===================== EMPLOYEES ===================== */}
        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Personal</CardTitle>
                <CardDescription>Registro y control de empleados</CardDescription>
              </div>

              <Dialog
                open={openDialogs.newEmployee}
                onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, newEmployee: open }))}
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
                    <DialogDescription>Complete los datos del nuevo empleado</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">Nombres *</Label>
                        <Input
                          id="first_name"
                          value={newEmployee.first_name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Apellidos *</Label>
                        <Input
                          id="last_name"
                          value={newEmployee.last_name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
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
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={newEmployee.phone}
                          onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={newEmployee.address}
                        onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="position">Cargo *</Label>
                        <Input
                          id="position"
                          value={newEmployee.position}
                          onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
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
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
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
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
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
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergency_contact_name">Contacto de Emergencia</Label>
                        <Input
                          id="emergency_contact_name"
                          value={newEmployee.emergency_contact_name}
                          onChange={(e) =>
                            setNewEmployee({ ...newEmployee, emergency_contact_name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergency_contact_phone">Teléfono de Emergencia</Label>
                        <Input
                          id="emergency_contact_phone"
                          value={newEmployee.emergency_contact_phone}
                          onChange={(e) =>
                            setNewEmployee({ ...newEmployee, emergency_contact_phone: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={createEmployee}
                      disabled={
                        !newEmployee.first_name ||
                        !newEmployee.last_name ||
                        !newEmployee.document_number ||
                        !newEmployee.position
                      }
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
                  <div className="text-center py-8 text-gray-500">No hay empleados registrados</div>
                ) : (
                  employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <Users className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{employee.position}</p>
                          <p className="text-xs text-gray-500">
                            {employee.employee_code || "—"} - {employee.department || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {contractTypes[employee.contract_type] || employee.contract_type || "—"}
                          </p>
                          <p className="text-xs text-gray-500">Ingreso: {formatDate(employee.hire_date)}</p>
                        </div>

                        <Badge className={`${employeeStatuses[employee.status]?.color || "bg-gray-500"} text-white`}>
                          {employeeStatuses[employee.status]?.label || employee.status || "—"}
                        </Badge>

                        <Button size="sm" variant="outline" onClick={() => viewEmployee(employee)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== ATTENDANCE ===================== */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Control de Asistencia</CardTitle>
                <CardDescription>Registro de entrada y salida del personal</CardDescription>
              </div>

              <Dialog
                open={openDialogs.newAttendance}
                onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, newAttendance: open }))}
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
                    <DialogDescription>Complete los datos de asistencia del empleado</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>Empleado *</Label>
                      <Select
                        value={newAttendance.employee_id}
                        onValueChange={(value) => setNewAttendance({ ...newAttendance, employee_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empleado" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((e) => e?.status === "ACTIVE")
                            .map((employee) => (
                              <SelectItem key={employee.id} value={String(employee.id)}>
                                {employee.first_name} {employee.last_name} - {employee.position}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Fecha *</Label>
                      <Input
                        type="date"
                        value={newAttendance.date}
                        onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Hora de Entrada</Label>
                        <Input
                          type="time"
                          value={newAttendance.check_in}
                          onChange={(e) => setNewAttendance({ ...newAttendance, check_in: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Hora de Salida</Label>
                        <Input
                          type="time"
                          value={newAttendance.check_out}
                          onChange={(e) => setNewAttendance({ ...newAttendance, check_out: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Minutos de Descanso</Label>
                        <Input
                          type="number"
                          value={newAttendance.break_minutes}
                          onChange={(e) => setNewAttendance({ ...newAttendance, break_minutes: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Horas Extra</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={newAttendance.overtime_hours}
                          onChange={(e) => setNewAttendance({ ...newAttendance, overtime_hours: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Observaciones</Label>
                      <Textarea
                        value={newAttendance.notes}
                        onChange={(e) => setNewAttendance({ ...newAttendance, notes: e.target.value })}
                      />
                    </div>

                    {newAttendance.check_in && newAttendance.check_out && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">
                          Horas trabajadas:{" "}
                          {calculateWorkedHours(
                            `${newAttendance.date}T${newAttendance.check_in}:00`,
                            `${newAttendance.date}T${newAttendance.check_out}:00`,
                            parseInt(newAttendance.break_minutes, 10)
                          ).toFixed(2)}
                          h
                        </p>
                        {isLate(`${newAttendance.date}T${newAttendance.check_in}:00`) && (
                          <p className="text-sm text-yellow-600 mt-1">⚠️ Tardanza registrada</p>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button onClick={createAttendance} disabled={!newAttendance.employee_id}>
                      Registrar Asistencia
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {attendance.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay registros de asistencia para hoy</div>
                ) : (
                  attendance.map((record, idx) => {
                    const rDate = safeDate(record?.date);
                    const inTime = safeDate(record?.check_in);
                    const outTime = safeDate(record?.check_out);

                    return (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          {record?.is_absent ? (
                            <UserX className="h-8 w-8 text-red-500" />
                          ) : (
                            <UserCheck className="h-8 w-8 text-green-500" />
                          )}
                          <div>
                            <p className="font-semibold">
                              {record?.employee?.first_name || "—"} {record?.employee?.last_name || ""}
                            </p>
                            <p className="text-sm text-gray-600">{record?.employee?.position || "—"}</p>
                            <p className="text-xs text-gray-500">
                              {rDate ? rDate.toLocaleDateString("es-PE") : "Fecha inválida"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {record?.is_absent ? (
                            <Badge variant="destructive">Ausente</Badge>
                          ) : (
                            <div>
                              <p className="text-sm font-medium">
                                {inTime
                                  ? inTime.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                                  : "--:--"}{" "}
                                -{" "}
                                {outTime
                                  ? outTime.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                                  : "--:--"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {typeof record?.worked_hours === "number"
                                  ? `${record.worked_hours.toFixed(2)}h trabajadas`
                                  : "Horario incompleto"}
                              </p>
                              {record?.is_late && (
                                <Badge variant="destructive" className="mt-1">
                                  Tardanza
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== CONTRACTS (COMPLETO) ===================== */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Gestión de Contratos</CardTitle>
                <CardDescription>Crear, editar, finalizar y consultar contratos</CardDescription>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchContracts} disabled={contractsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${contractsLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
                <Button onClick={openNewContract}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Nuevo Contrato
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nombre, código, DNI o tipo..."
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                  />
                </div>

                <div className="w-full md:w-64">
                  <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="ACTIVE">Vigentes</SelectItem>
                      <SelectItem value="EXPIRED">Vencidos</SelectItem>
                      <SelectItem value="TERMINATED">Terminados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredContracts.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No hay contratos para mostrar (o tu backend no devuelve nada todavía).
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredContracts.map((c) => {
                    const emp = employeeById.get(String(c.employee_id)) || {};
                    const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
                    const status = calcContractStatus(c);

                    return (
                      <div
                        key={String(c.id)}
                        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start gap-4">
                          <CalendarDays className="h-8 w-8 text-indigo-500 mt-1" />
                          <div>
                            <p className="font-semibold">{fullName || "Empleado desconocido"}</p>
                            <p className="text-sm text-gray-600">
                              {emp.employee_code || "—"} • {emp.position || "—"} • {emp.department || "—"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {contractTypes[c.contract_type] || c.contract_type || "—"} •{" "}
                              Inicio: {formatDate(c.start_date)} • Fin: {c.end_date ? formatDate(c.end_date) : "—"}
                            </p>
                            <p className="text-xs text-gray-500">Salario: {formatMoney(c.salary ?? emp.salary ?? 0)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <Badge className={`${contractStatuses[status]?.color || "bg-gray-600"} text-white`}>
                            {contractStatuses[status]?.label || status}
                          </Badge>

                          <Button size="sm" variant="outline" onClick={() => openViewContract(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => openEditContract(c)}>
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => terminateContract(c)}
                            disabled={status === "TERMINATED"}
                            className="border-red-300"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Contract Dialog */}
          <Dialog
            open={openDialogs.newContract}
            onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, newContract: open }))}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Contrato</DialogTitle>
                <DialogDescription>Registre un contrato para un empleado</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Empleado *</Label>
                  <Select
                    value={contractForm.employee_id}
                    onValueChange={(v) => setContractForm((p) => ({ ...p, employee_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.first_name} {e.last_name} - {e.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={contractForm.contract_type}
                      onValueChange={(v) => setContractForm((p) => ({ ...p, contract_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(contractTypes).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Estado</Label>
                    <Select
                      value={contractForm.status}
                      onValueChange={(v) => setContractForm((p) => ({ ...p, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Vigente</SelectItem>
                        <SelectItem value="EXPIRED">Vencido</SelectItem>
                        <SelectItem value="TERMINATED">Terminado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Salario</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={contractForm.salary}
                      onChange={(e) => setContractForm((p) => ({ ...p, salary: e.target.value }))}
                      placeholder="Ej: 1500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha inicio *</Label>
                    <Input
                      type="date"
                      value={contractForm.start_date}
                      onChange={(e) => setContractForm((p) => ({ ...p, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fecha fin</Label>
                    <Input
                      type="date"
                      value={contractForm.end_date}
                      onChange={(e) => setContractForm((p) => ({ ...p, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>URL del documento (opcional)</Label>
                  <Input
                    value={contractForm.document_url}
                    onChange={(e) => setContractForm((p) => ({ ...p, document_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={contractForm.notes}
                    onChange={(e) => setContractForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Observaciones..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, newContract: false }))}>
                  Cancelar
                </Button>
                <Button onClick={createContract}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Crear Contrato
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Contract Dialog */}
          <Dialog
            open={openDialogs.editContract}
            onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, editContract: open }))}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Contrato</DialogTitle>
                <DialogDescription>Actualice datos del contrato</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Empleado *</Label>
                  <Select
                    value={contractForm.employee_id}
                    onValueChange={(v) => setContractForm((p) => ({ ...p, employee_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.first_name} {e.last_name} - {e.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={contractForm.contract_type}
                      onValueChange={(v) => setContractForm((p) => ({ ...p, contract_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(contractTypes).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Estado</Label>
                    <Select
                      value={contractForm.status}
                      onValueChange={(v) => setContractForm((p) => ({ ...p, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Vigente</SelectItem>
                        <SelectItem value="EXPIRED">Vencido</SelectItem>
                        <SelectItem value="TERMINATED">Terminado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Salario</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={contractForm.salary}
                      onChange={(e) => setContractForm((p) => ({ ...p, salary: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha inicio *</Label>
                    <Input
                      type="date"
                      value={contractForm.start_date}
                      onChange={(e) => setContractForm((p) => ({ ...p, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fecha fin</Label>
                    <Input
                      type="date"
                      value={contractForm.end_date}
                      onChange={(e) => setContractForm((p) => ({ ...p, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>URL del documento (opcional)</Label>
                  <Input
                    value={contractForm.document_url}
                    onChange={(e) => setContractForm((p) => ({ ...p, document_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={contractForm.notes}
                    onChange={(e) => setContractForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, editContract: false }))}>
                  Cancelar
                </Button>
                <Button onClick={updateContract}>
                  <Edit className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Contract Dialog */}
          <Dialog
            open={openDialogs.viewContract}
            onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, viewContract: open }))}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalle de Contrato</DialogTitle>
                <DialogDescription>Información completa del contrato</DialogDescription>
              </DialogHeader>

              {selectedContract && (() => {
                const emp = employeeById.get(String(selectedContract.employee_id)) || {};
                const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
                const status = calcContractStatus(selectedContract);

                return (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <p className="font-semibold text-lg">{fullName || "Empleado desconocido"}</p>
                      <p className="text-sm text-gray-600">
                        {emp.employee_code || "—"} • {emp.position || "—"} • {emp.department || "—"}
                      </p>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <strong>Tipo:</strong> {contractTypes[selectedContract.contract_type] || selectedContract.contract_type || "—"}
                        </div>
                        <div>
                          <strong>Estado:</strong>{" "}
                          <Badge className={`${contractStatuses[status]?.color || "bg-gray-600"} text-white ml-2`}>
                            {contractStatuses[status]?.label || status}
                          </Badge>
                        </div>
                        <div>
                          <strong>Inicio:</strong> {formatDate(selectedContract.start_date)}
                        </div>
                        <div>
                          <strong>Fin:</strong> {selectedContract.end_date ? formatDate(selectedContract.end_date) : "—"}
                        </div>
                        <div>
                          <strong>Salario:</strong> {formatMoney(selectedContract.salary ?? emp.salary ?? 0)}
                        </div>
                        <div>
                          <strong>Documento:</strong>{" "}
                          {selectedContract.document_url ? (
                            <a className="text-blue-600 underline" href={selectedContract.document_url} target="_blank" rel="noreferrer">
                              Ver archivo
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>

                      {selectedContract.notes ? (
                        <div className="mt-3 text-sm">
                          <strong>Notas:</strong>
                          <p className="text-gray-700 mt-1">{selectedContract.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, viewContract: false }))}>
                  Cerrar
                </Button>
                {selectedContract && (
                  <>
                    <Button variant="outline" onClick={() => openEditContract(selectedContract)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-300"
                      onClick={() => terminateContract(selectedContract)}
                      disabled={calcContractStatus(selectedContract) === "TERMINATED"}
                    >
                      <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                      Terminar
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===================== REPORTS (COMPLETO) ===================== */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de RRHH</CardTitle>
              <CardDescription>Exportaciones rápidas y vista imprimible</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="font-medium">Rango para reporte de asistencia</div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div>
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        value={reportRange.date_from}
                        onChange={(e) => setReportRange((p) => ({ ...p, date_from: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="date"
                        value={reportRange.date_to}
                        onChange={(e) => setReportRange((p) => ({ ...p, date_to: e.target.value }))}
                      />
                    </div>
                    <Button variant="outline" onClick={() => previewReport("attendance")}>
                      <Printer className="h-4 w-4 mr-2" />
                      Vista previa
                    </Button>
                    <Button variant="outline" onClick={exportAttendanceCSV}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* PLANILLA */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Planilla</CardTitle>
                    <CardDescription>Exporta sueldos y datos del personal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={() => previewReport("payroll")}>
                      <Printer className="h-4 w-4 mr-2" />
                      Vista previa
                    </Button>
                    <Button variant="outline" className="w-full" onClick={exportPayrollCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </CardContent>
                </Card>

                {/* PERSONAL ACTIVO */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Activo</CardTitle>
                    <CardDescription>Lista de personal vigente</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={() => previewReport("active")}>
                      <Printer className="h-4 w-4 mr-2" />
                      Vista previa
                    </Button>
                    <Button variant="outline" className="w-full" onClick={exportActiveEmployeesCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </CardContent>
                </Card>

                {/* INFO */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notas</CardTitle>
                    <CardDescription>Sobre PDFs</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 space-y-2">
                    <p>
                      Si quieres PDF real (bonito) necesitas backend (ej. endpoint que genere PDF) o una librería
                      (jsPDF/pdfmake). Aquí lo hago “serio” sin dependencias: <b>vista imprimible</b> + CSV.
                    </p>
                    <p className="text-xs">
                      Si tu backend ya genera PDFs, dime los endpoints y lo conecto en 2 líneas.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Report Preview Dialog */}
          <Dialog
            open={openDialogs.reportPreview}
            onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, reportPreview: open }))}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{reportPreview.title || "Vista previa"}</DialogTitle>
                <DialogDescription>Imprime directo desde aquí o exporta CSV</DialogDescription>
              </DialogHeader>

              <div className="max-h-[60vh] overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {reportPreview.columns.map((c) => (
                        <th key={c} className="text-left p-2 border-b">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportPreview.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {r.map((v, j) => (
                          <td key={j} className="p-2 border-b">
                            {String(v ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {reportPreview.rows.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-gray-500" colSpan={reportPreview.columns.length}>
                          No hay datos para el rango seleccionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {reportPreview.footer ? <div className="text-sm text-gray-600">{reportPreview.footer}</div> : null}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    openPrintWindow({
                      title: reportPreview.title,
                      columns: reportPreview.columns,
                      rows: reportPreview.rows,
                      footer: reportPreview.footer,
                    })
                  }
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, reportPreview: false }))}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* ===================== View Employee Dialog ===================== */}
      <Dialog
        open={openDialogs.viewEmployee}
        onOpenChange={(open) => setOpenDialogs((p) => ({ ...p, viewEmployee: open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Empleado</DialogTitle>
            <DialogDescription>{selectedEmployee?.employee_code || ""}</DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Información Personal</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <strong>Nombre:</strong> {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </p>
                    <p>
                      <strong>DNI:</strong> {selectedEmployee.document_number}
                    </p>
                    <p>
                      <strong>Fecha de Nacimiento:</strong> {formatDate(selectedEmployee.birth_date)}
                    </p>
                    <p>
                      <strong>Email:</strong> {selectedEmployee.email || "No especificado"}
                    </p>
                    <p>
                      <strong>Teléfono:</strong> {selectedEmployee.phone || "No especificado"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Información Laboral</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <strong>Cargo:</strong> {selectedEmployee.position}
                    </p>
                    <p>
                      <strong>Departamento:</strong> {selectedEmployee.department || "—"}
                    </p>
                    <p>
                      <strong>Fecha de Ingreso:</strong> {formatDate(selectedEmployee.hire_date)}
                    </p>
                    <p>
                      <strong>Tipo de Contrato:</strong>{" "}
                      {contractTypes[selectedEmployee.contract_type] || selectedEmployee.contract_type || "—"}
                    </p>
                    <p>
                      <strong>Estado:</strong>
                      <Badge
                        className={`ml-2 ${employeeStatuses[selectedEmployee.status]?.color || "bg-gray-500"} text-white`}
                      >
                        {employeeStatuses[selectedEmployee.status]?.label || selectedEmployee.status || "—"}
                      </Badge>
                    </p>
                    <p>
                      <strong>Salario:</strong> {formatMoney(selectedEmployee.salary ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {(selectedEmployee.emergency_contact_name || selectedEmployee.emergency_contact_phone) && (
                <div>
                  <h4 className="font-medium">Contacto de Emergencia</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <strong>Nombre:</strong> {selectedEmployee.emergency_contact_name || "No especificado"}
                    </p>
                    <p>
                      <strong>Teléfono:</strong> {selectedEmployee.emergency_contact_phone || "No especificado"}
                    </p>
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
            <Button variant="outline" onClick={() => setOpenDialogs((p) => ({ ...p, viewEmployee: false }))}>
              Cerrar
            </Button>
            <Button variant="outline" onClick={openNewContract} disabled={!selectedEmployee}>
              <FileSignature className="h-4 w-4 mr-2" />
              Crear Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRDashboard;
