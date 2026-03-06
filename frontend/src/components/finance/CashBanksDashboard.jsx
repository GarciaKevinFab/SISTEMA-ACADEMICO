// src/modules/finance/CashBanksDashboard.jsx — UI/UX mejorado
// Toda la lógica de negocio preservada exactamente.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CashBanks } from "../../services/finance.service";
import { Button } from "../../components/ui/button";
import { toast } from "../../utils/safeToast";
import { Plus, Save, RefreshCw, Loader2, Landmark, TrendingUp, TrendingDown, Wallet, X } from "lucide-react";
import { fmtCurrency, formatApiError, toLimaDateTime } from "../../utils/format";
import { clampVariant, optVal, safeText } from "../../utils/ui";

/* ─── inject styles ─── */
function InjectCashStyles() {
  useEffect(() => {
    const id = "cash-styles";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id + "-font"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
          .cb-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .cb-root * { font-family: inherit; }

          /* ── dark finance header ── */
          .cb-topbar {
            background: linear-gradient(135deg, #1E2F49 0%, #1a2a42 100%);
            border-bottom: 1px solid rgba(255,255,255,.08);
            position:sticky; top:0; z-index:30;
            padding: 18px 24px;
            display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
          }

          /* stat cards */
          .cb-stat { border-radius:16px; border:1px solid #E2E8F0; background:#fff; overflow:hidden; }
          .cb-stat-body { padding:20px 24px; }
          .cb-stat-label { font-size:10px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:.12em; margin-bottom:6px; }
          .cb-stat-value { font-size:32px; font-weight:800; letter-spacing:-.02em; font-variant-numeric:tabular-nums; line-height:1; }

          /* session card */
          .cb-session-card { border-radius:16px; border:1px solid #E2E8F0; background:#fff; overflow:hidden; }

          /* movement form card */
          .cb-mov-card { border-radius:16px; border:1px solid #E2E8F0; border-left:4px solid #3B82F6; background:#fff; }
          .cb-mov-card-body { padding:20px 24px; display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; }

          /* field label */
          .cb-label { font-size:10px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:.1em; display:block; margin-bottom:5px; }

          /* native input / select */
          .cb-input, .cb-select {
            width:100%; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;
            padding:0 10px; height:40px; font-size:13.5px; color:#1E293B; outline:none;
            transition:border-color .15s, box-shadow .15s; font-family:inherit;
          }
          .cb-select { appearance:none; padding:0 32px 0 10px; cursor:pointer; }
          .cb-input:focus, .cb-select:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,.12); background:#fff; }
          .cb-input:disabled, .cb-select:disabled { opacity:.5; cursor:not-allowed; }
          .cb-input-right { text-align:right; font-size:16px; font-weight:700; }
          .cb-textarea { height:auto; padding:8px 10px; resize:vertical; }

          /* table */
          .cb-table-wrap { border-radius:16px; border:1px solid #E2E8F0; background:#fff; overflow:hidden; }
          .cb-th { padding:10px 16px; font-size:10px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:.1em; background:#F8FAFC; border-bottom:1px solid #E2E8F0; }
          .cb-td { padding:11px 16px; font-size:13px; color:#475569; }
          .cb-tr { border-bottom:1px solid #F1F5F9; transition:background .1s; }
          .cb-tr:hover { background:#F8FAFC; }

          /* type badges */
          .cb-badge-in  { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:#DCFCE7; color:#166534; border:1px solid #86EFAC; }
          .cb-badge-out { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; }
          .cb-badge-open   { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:#DCFCE7; color:#166534; border:1px solid #86EFAC; }
          .cb-badge-closed { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:#F1F5F9; color:#64748B; border:1px solid #CBD5E1; }

          /* modal overlay */
          .cb-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(4px); z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; }
          .cb-modal { background:#fff; border-radius:20px; width:100%; max-width:480px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,.2); }
          .cb-modal-head { padding:20px 24px 16px; border-bottom:1px solid #F1F5F9; display:flex; align-items:center; justify-content:space-between; gap:8px; }
          .cb-modal-body { padding:20px 24px; space-y:12px; }
          .cb-modal-foot { padding:16px 24px; border-top:1px solid #F1F5F9; display:flex; justify-content:flex-end; gap:10px; }

          /* select arrow wrapper */
          .cb-sel-wrap { position:relative; }
          .cb-sel-wrap svg { position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; color:#94A3B8; width:14px; height:14px; }

          /* session selector highlight */
          .cb-session-item-open  { font-weight:800; color:#1E40AF; }
          .cb-session-item-closed { color:#64748B; }

          @keyframes cb-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
          .cb-fade { animation:cb-fade .24s ease both; }
          @keyframes cb-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
          .cb-skel { background:#E2E8F0; border-radius:6px; animation:cb-pulse 1.4s ease-in-out infinite; }
        `;
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); document.getElementById(id + "-font")?.remove(); };
  }, []);
  return null;
}

/* ─── preserved helpers ─── */
const STATUS_CFG = {
  OPEN: { label: "Abierta", variant: "default" },
  CLOSED: { label: "Cerrada", variant: "secondary" },
};
const TYPE_CFG = {
  IN: { label: "Ingreso", variant: "default" },
  OUT: { label: "Egreso", variant: "secondary" },
};
const normStatus = (status) => {
  if (status == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof status === "object" ? (status.code ?? status.value ?? "") : status || "").toUpperCase();
  const cfg = STATUS_CFG[code];
  return { code, label: cfg?.label || (code || "-"), variant: clampVariant(cfg?.variant || "secondary") };
};
const normType = (type) => {
  if (type == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof type === "object" ? (type.code ?? type.value ?? "") : type || "").toUpperCase();
  const cfg = TYPE_CFG[code];
  return { code, label: cfg?.label || (code || "-"), variant: clampVariant(cfg?.variant || (code === "IN" ? "default" : "secondary")) };
};
const showApiError = (e, fallbackMsg) => toast.error(formatApiError(e, fallbackMsg));

/* ─── modal ─── */
function Modal({ open, onClose, title, accent = "blue", children, footer }) {
  if (!open) return null;
  const accentMap = { blue: "#3B82F6", red: "#EF4444" };
  return (
    <div className="cb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cb-modal cb-fade">
        <div style={{ height: 3, background: accentMap[accent] || accentMap.blue }} />
        <div className="cb-modal-head">
          <p className="text-base font-800 text-slate-800">{title}</p>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="cb-modal-body space-y-4">{children}</div>
        {footer && <div className="cb-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── field helper ─── */
const Field = ({ label, children }) => (
  <div>
    <label className="cb-label">{label}</label>
    {children}
  </div>
);

/* ─── SelectArrow ─── */
const SelectArrow = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function CashBanksDashboard() {
  const [sessions, setSessions] = useState([]);
  const [currentId, setCurrentId] = useState(undefined);
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  const [openForm, setOpenForm] = useState({ opening_amount: "", note: "" });
  const [closeForm, setCloseForm] = useState({ closing_amount: "", note: "" });
  const [newMov, setNewMov] = useState({ type: "IN", amount: "", concept: "" });

  const [busyOpen, setBusyOpen] = useState(false);
  const [busyClose, setBusyClose] = useState(false);
  const [busyMov, setBusyMov] = useState(false);

  const current = useMemo(() => sessions.find((s) => String(s.id) === String(currentId)), [sessions, currentId]);
  const statusMeta = normStatus(current?.status);

  const totals = useMemo(() => {
    const ins = movs.filter((m) => normType(m.type).code === "IN").reduce((a, m) => a + Number(m.amount || 0), 0);
    const outs = movs.filter((m) => normType(m.type).code === "OUT").reduce((a, m) => a + Number(m.amount || 0), 0);
    const opening = Number(current?.opening_amount || 0);
    return { ins, outs, opening, balance: opening + ins - outs };
  }, [movs, current]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let alive = true;
    try {
      const d = await CashBanks.sessions();
      const list = d?.items ?? d ?? [];
      if (!alive) return;
      setSessions(list);
      const open = list.find((s) => normStatus(s.status).code === "OPEN" && optVal(s.id));
      const firstValid = list.find((s) => optVal(s.id));
      if (!currentId) {
        const initial = open?.id ?? firstValid?.id;
        setCurrentId(initial != null ? String(initial) : undefined);
        if (!initial && list.length === 0) setOpenDlg(true);
      }
    } catch (e) {
      if (alive) showApiError(e, "Error cargando sesiones");
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
  }, [currentId]);

  const loadMovs = useCallback(async () => {
    if (!currentId) return;
    const myId = currentId;
    try {
      const d = await CashBanks.movements(myId);
      setMovs((prev) => (currentId === myId ? (d?.items ?? d ?? []) : prev));
    } catch (e) { console.error("Error cargando movs:", e); }
  }, [currentId]);

  useEffect(() => {
    let cleanup;
    (async () => { cleanup = await loadSessions(); })();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [loadSessions]);

  useEffect(() => { loadMovs(); }, [loadMovs]);

  const openSession = async () => {
    try {
      setBusyOpen(true);
      const payload = { opening_amount: Number(openForm.opening_amount || 0), note: openForm.note || undefined };
      const r = await CashBanks.openSession(payload);
      toast.success("Sesión abierta correctamente");
      setOpenForm({ opening_amount: "", note: "" });
      setOpenDlg(false);
      await loadSessions();
      if (r?.id) setCurrentId(String(r.id));
    } catch (e) { showApiError(e, "No se pudo abrir la sesión"); }
    finally { setBusyOpen(false); }
  };

  const closeSession = async () => {
    if (!current?.id) return;
    try {
      setBusyClose(true);
      const closingValue = closeForm.closing_amount === "" ? totals.balance : Number(closeForm.closing_amount);
      const payload = { closing_amount: Number.isFinite(closingValue) ? closingValue : totals.balance, note: closeForm.note || undefined };
      await CashBanks.closeSession(current.id, payload);
      toast.success("Sesión cerrada correctamente");
      setCloseForm({ closing_amount: "", note: "" });
      setCloseDlg(false);
      await loadSessions();
    } catch (e) { showApiError(e, "No se pudo cerrar la sesión"); }
    finally { setBusyClose(false); }
  };

  const addMovement = async () => {
    if (!current?.id) return toast.error("Error: Sesión no válida");
    const amountNum = parseFloat(newMov.amount);
    const conceptVal = newMov.concept?.trim();
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) return toast.error("Ingresa un monto válido");
    if (!conceptVal) return toast.error("Ingresa un concepto");
    try {
      setBusyMov(true);
      await CashBanks.addMovement(current.id, { type: newMov.type, amount: Number(amountNum), concept: conceptVal });
      toast.success("Movimiento registrado");
      setNewMov({ type: "IN", amount: "", concept: "" });
      await loadMovs();
      await loadSessions();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || "Error interno";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally { setBusyMov(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm font-700 text-slate-400">Cargando caja…</p>
      </div>
    );
  }

  const isOpen = statusMeta.code === "OPEN";

  return (
    <>
      <InjectCashStyles />
      <div className="cb-root flex flex-col min-h-screen bg-slate-50 pb-10">

        {/* ── sticky dark topbar ── */}
        <div className="cb-topbar">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-xl font-900 text-white tracking-tight">Caja y Bancos</h2>
              <p className="text-[10px] text-blue-200/50 font-800 uppercase tracking-widest mt-0.5">Gestión de Flujo de Efectivo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => { loadSessions(); loadMovs(); }}
              className="h-9 px-4 text-white/70 hover:text-white hover:bg-white/10 text-xs font-700 gap-1.5 border border-white/10 rounded-xl">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </Button>
            <Button size="sm" onClick={() => setOpenDlg(true)}
              className="h-9 px-4 bg-blue-500 hover:bg-blue-400 text-white text-xs font-700 gap-1.5 rounded-xl shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Abrir Caja
            </Button>
            {isOpen && (
              <Button size="sm" onClick={() => setCloseDlg(true)}
                className="h-9 px-4 bg-red-500 hover:bg-red-400 text-white text-xs font-700 gap-1.5 rounded-xl shadow-sm">
                <Save className="w-3.5 h-3.5" /> Cerrar Caja
              </Button>
            )}
          </div>
        </div>

        {/* ── main content ── */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          {/* session selector + stat cards */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* session card */}
            <div className="cb-session-card lg:col-span-1">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <p className="text-[10px] font-800 text-slate-400 uppercase tracking-widest text-center">Sesión de Caja</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="cb-sel-wrap">
                  <select className="cb-select" value={currentId || ""} onChange={(e) => setCurrentId(e.target.value)}>
                    <option value="" disabled>Seleccionar sesión…</option>
                    {sessions.map((s) => optVal(s.id) && (
                      <option key={s.id} value={String(s.id)}>
                        #{s.id} — {toLimaDateTime(s.opened_at).split(",")[0]}
                      </option>
                    ))}
                  </select>
                  <SelectArrow />
                </div>

                {current && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className={`${statusMeta.code === "OPEN" ? "cb-badge-open" : "cb-badge-closed"}`}>
                      {statusMeta.label}
                    </span>
                    <div className="text-right">
                      <p className="text-[10px] font-800 text-slate-400 uppercase tracking-wider">Apertura</p>
                      <p className="text-sm font-mono font-700 text-slate-700 mt-0.5">
                        {current ? toLimaDateTime(current.opened_at).split(",")[1] : "--:--"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* stat cards */}
            {current ? (
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="cb-stat cb-fade" style={{ borderTop: "3px solid #10B981" }}>
                  <div className="cb-stat-body">
                    <div className="flex items-center justify-between mb-3">
                      <p className="cb-stat-label">Ingresos</p>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                    <p className="cb-stat-value text-emerald-600">{fmtCurrency(totals.ins)}</p>
                  </div>
                </div>

                <div className="cb-stat cb-fade" style={{ borderTop: "3px solid #EF4444", animationDelay: "40ms" }}>
                  <div className="cb-stat-body">
                    <div className="flex items-center justify-between mb-3">
                      <p className="cb-stat-label">Egresos</p>
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      </div>
                    </div>
                    <p className="cb-stat-value text-red-500">{fmtCurrency(totals.outs)}</p>
                  </div>
                </div>

                <div className="cb-stat cb-fade" style={{ borderTop: "3px solid #3B82F6", animationDelay: "80ms", boxShadow: "0 0 0 2px rgba(59,130,246,.15)" }}>
                  <div className="cb-stat-body">
                    <div className="flex items-center justify-between mb-3">
                      <p className="cb-stat-label" style={{ color: "#2563EB" }}>Saldo Neto</p>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <p className="cb-stat-value text-blue-900">{fmtCurrency(totals.balance)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-4 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10">
                <p className="text-sm font-700 text-slate-400">Selecciona una sesión de caja</p>
              </div>
            )}
          </div>

          {/* movement form */}
          {isOpen && current && (
            <div className="cb-mov-card cb-fade">
              <div className="cb-mov-card-body">
                <div className="w-full sm:w-48 shrink-0">
                  <label className="cb-label">Tipo Operación</label>
                  <div className="cb-sel-wrap">
                    <select className="cb-select" value={newMov.type}
                      onChange={(e) => setNewMov({ ...newMov, type: e.target.value })}>
                      <option value="IN">Ingreso (+)</option>
                      <option value="OUT">Egreso (-)</option>
                    </select>
                    <SelectArrow />
                  </div>
                </div>

                <div className="w-full sm:w-52 shrink-0">
                  <label className="cb-label">Monto (S/)</label>
                  <input type="number" className="cb-input cb-input-right" placeholder="0.00"
                    value={newMov.amount} onChange={(e) => setNewMov({ ...newMov, amount: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addMovement()} />
                </div>

                <div className="flex-1 min-w-0">
                  <label className="cb-label">Concepto o Descripción</label>
                  <input type="text" className="cb-input" placeholder="Ej. Pago de matrícula, servicios, etc."
                    value={newMov.concept} onChange={(e) => setNewMov({ ...newMov, concept: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addMovement()} />
                </div>

                <Button onClick={addMovement} disabled={busyMov}
                  className="h-10 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5 shadow-sm shrink-0">
                  {busyMov ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Movimiento"}
                </Button>
              </div>
            </div>
          )}

          {/* movements table */}
          <div className="cb-table-wrap">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-800 text-slate-700 uppercase tracking-widest">
                Historial de Movimientos
                <span className="text-blue-600 font-800 ml-2 normal-case">— {movs.length} registros</span>
              </p>
              <span className="text-[10px] font-800 text-slate-400 uppercase tracking-wider">Libro Diario</span>
            </div>

            <div className="overflow-x-auto">
              <div className="max-h-[620px] overflow-y-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr>
                      <th className="cb-th text-left w-28">Hora</th>
                      <th className="cb-th text-left w-36">Operación</th>
                      <th className="cb-th text-left">Concepto</th>
                      <th className="cb-th text-right w-48">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                              <Wallet className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-700 text-slate-400">No se han registrado movimientos en esta sesión.</p>
                          </div>
                        </td>
                      </tr>
                    ) : movs.map((m, idx) => {
                      const tmeta = normType(m.type);
                      let timeStr = "--:--";
                      try { timeStr = toLimaDateTime(m.date).split(" ")[1]; } catch (_) { }
                      return (
                        <tr key={m.id || idx} className="cb-tr">
                          <td className="cb-td font-mono text-xs text-slate-400 font-700 whitespace-nowrap">{timeStr}</td>
                          <td className="cb-td whitespace-nowrap">
                            <span className={tmeta.code === "IN" ? "cb-badge-in" : "cb-badge-out"}>{tmeta.label}</span>
                          </td>
                          <td className="cb-td text-[12.5px] font-700 text-slate-700 uppercase tracking-tight">{safeText(m.concept)}</td>
                          <td className={`cb-td text-right font-800 text-lg tabular-nums ${tmeta.code === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                            {tmeta.code === "IN" ? "+" : "−"} {fmtCurrency(m.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ── modal: abrir caja ── */}
        <Modal open={openDlg} onClose={() => setOpenDlg(false)} title="Abrir Sesión de Caja"
          footer={
            <>
              <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm" onClick={() => setOpenDlg(false)} disabled={busyOpen}>
                Cancelar
              </Button>
              <Button className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5"
                onClick={openSession} disabled={busyOpen}>
                {busyOpen ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Abriendo…</> : <><Plus className="w-3.5 h-3.5" /> Abrir Caja</>}
              </Button>
            </>
          }>
          <Field label="Monto Inicial (S/)">
            <input type="number" className="cb-input cb-input-right" placeholder="0.00"
              value={openForm.opening_amount} onChange={(e) => setOpenForm({ ...openForm, opening_amount: e.target.value })} />
          </Field>
          <Field label="Nota (opcional)">
            <textarea className="cb-input cb-textarea" rows={2} placeholder="Observaciones de apertura…"
              value={openForm.note} onChange={(e) => setOpenForm({ ...openForm, note: e.target.value })} />
          </Field>
        </Modal>

        {/* ── modal: cerrar caja ── */}
        <Modal open={closeDlg} onClose={() => setCloseDlg(false)} title="Cerrar Sesión de Caja" accent="red"
          footer={
            <>
              <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm" onClick={() => setCloseDlg(false)} disabled={busyClose}>
                Cancelar
              </Button>
              <Button className="h-9 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-700 gap-1.5"
                onClick={closeSession} disabled={busyClose}>
                {busyClose ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cerrando…</> : <><Save className="w-3.5 h-3.5" /> Cerrar Caja</>}
              </Button>
            </>
          }>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs font-800 text-slate-500 uppercase tracking-wider">Saldo calculado</span>
            <span className="text-lg font-800 text-blue-700 tabular-nums">{fmtCurrency(totals.balance)}</span>
          </div>
          <Field label="Monto de Cierre (S/)">
            <input type="number" className="cb-input cb-input-right"
              placeholder={String(totals.balance)}
              value={closeForm.closing_amount} onChange={(e) => setCloseForm({ ...closeForm, closing_amount: e.target.value })} />
          </Field>
          <Field label="Nota (opcional)">
            <textarea className="cb-input cb-textarea" rows={2} placeholder="Observaciones de cierre…"
              value={closeForm.note} onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })} />
          </Field>
        </Modal>

      </div>
    </>
  );
}