import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

import PublicAdmissionCallDetails from "./PublicAdmissionCallDetails";
import ApplicationWizard from "./ApplicationWizard";

import {
  Calendar, Clock, FileText, Search, Award, MapPin, Phone, Mail,
  ChevronRight, School, ArrowLeft, ChevronDown,
  CheckCircle2, XCircle, Eye, AlertCircle, Loader2,
  Upload, Users, CreditCard,
} from "lucide-react";

/* ─── Helpers ────────────────────────────────────────────────── */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d.map(e => {
        const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
        return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

const getReglamentoUrl = (call) => {
  const c = call?.regulation_url || call?.reglamento_url || call?.rules_url ||
    call?.regulationPdf || call?.regulation_pdf || call?.reglamento_pdf ||
    call?.documents?.reglamento || call?.documents?.rules || null;
  return typeof c === "string" && c.trim() ? c.trim() : null;
};

/* ─── Status configs ─────────────────────────────────────────── */
const APP_STATUS = {
  CREATED: { label: "Registrado", cls: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock },
  PHASE1_PASSED: { label: "Apto para Entrevista", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  PHASE1_FAILED: { label: "No apto (Fase 1)", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  PHASE2_SCORED: { label: "Entrevista registrada", cls: "bg-violet-50 text-violet-700 border-violet-200", icon: Eye },
  ADMITTED: { label: "ADMITIDO", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  NOT_ADMITTED: { label: "NO ADMITIDO", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
};
const getAppStatus = (s) => APP_STATUS[s] ?? { label: s || "—", cls: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock };

/* ─── Call status badge ──────────────────────────────────────── */
const getCallBadge = (call) => {
  const now = new Date();
  const s = call?.registration_start ? new Date(call.registration_start) : null;
  const e = call?.registration_end ? new Date(call.registration_end) : null;
  if (!s || !e) return { label: "Por confirmar", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  if (now < s) return { label: "Próximamente", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (now >= s && now <= e) return { label: "Inscripciones abiertas", cls: "bg-emerald-50 text-emerald-700 border-emerald-300 font-extrabold" };
  return { label: "Cerrada", cls: "bg-slate-100 text-slate-500 border-slate-200" };
};

/* ─── Sub-components ─────────────────────────────────────────── */
const AppStatusBadge = ({ status }) => {
  const { label, cls, icon: Icon } = getAppStatus(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>
      <Icon size={10} />{label}
    </span>
  );
};

const MetaItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0 mt-0.5">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-snug">{value}</p>
    </div>
  </div>
);

const ScoreCell = ({ label, value }) => (
  <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-center gap-0.5">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-xl font-black text-slate-800 tabular-nums">{value ?? "—"}</p>
  </div>
);

/* ─── Call Card ──────────────────────────────────────────────── */
const CallCard = ({ call, onDetails, onReglamento }) => {
  const { label, cls } = getCallBadge(call);
  const isOpen = label === "Inscripciones abiertas";

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-all duration-300 hover:shadow-lg ${isOpen ? "border-emerald-200 shadow-sm" : "border-slate-200 shadow-sm"}`}>
      {/* Top accent */}
      {isOpen && <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />}

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/30 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-slate-900 leading-tight">{call.name}</h3>
          {call.description && (
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{call.description}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center text-[11px] px-3 py-1 rounded-full border tracking-wide ${cls}`}>
          {label.toUpperCase()}
        </span>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Meta grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetaItem icon={Calendar} label="Inscripción"
            value={`${fmtDate(call.registration_start)} – ${fmtDate(call.registration_end)}`} />
          {call.exam_date && (
            <MetaItem icon={Clock} label="Examen" value={fmtDate(call.exam_date)} />
          )}
          <MetaItem icon={School} label="Periodo"
            value={`${call.academic_year}${call.academic_period ? `-${call.academic_period}` : ""}`} />
          {Number(call.application_fee) > 0 && (
            <MetaItem icon={CreditCard} label="Costo"
              value={`S/ ${Number(call.application_fee).toFixed(2)}`} />
          )}
        </div>

        {/* Careers */}
        {(call.careers || []).length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-blue-500" /> Programas disponibles
            </p>
            <div className="flex flex-wrap gap-2">
              {call.careers.map((career) => (
                <span
                  key={String(career.id ?? career.career_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200"
                >
                  {career.name}
                  {career.vacancies != null && (
                    <span className="text-[10px] text-slate-400 font-bold border-l border-slate-300 pl-2 ml-0.5 flex items-center gap-0.5">
                      <Users size={9} />{career.vacancies}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="button" variant="outline" className="rounded-xl h-10 px-5 font-semibold"
            onClick={() => onReglamento(call)}>
            Reglamento
          </Button>
          <Button type="button"
            className="rounded-xl h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold gap-1.5"
            onClick={() => onDetails(call)}>
            Ver detalles <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ─── Search Result ──────────────────────────────────────────── */
const SearchResult = ({ result, onUploadVoucher }) => {
  if (result.error) {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
        <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
        <p className="text-sm text-rose-700 font-semibold">{result.error}</p>
      </div>
    );
  }

  const paymentRequired = result.payment?.required;
  const paymentAmount = Number(result.payment?.amount || 0).toFixed(2);
  const paymentStatus = result.payment?.status || "—";

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Result header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <p className="text-sm font-extrabold text-slate-800">Resultado</p>
        <AppStatusBadge status={result.status} />
      </div>

      <div className="p-5 space-y-4">
        {/* Applicant info */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Postulante</p>
            <p className="text-sm font-bold text-slate-800">{result.applicant?.names || "—"}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              DNI: {result.applicant?.dni || "—"} · #{result.application_id ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Carrera</p>
            <p className="text-sm font-semibold text-slate-700">{result.career_name || "—"}</p>
          </div>
        </div>

        {/* Scores */}
        {result.score ? (
          <div className="grid grid-cols-3 gap-2">
            <ScoreCell label="Fase 1" value={result.score.phase1_total} />
            <ScoreCell label="Fase 2" value={result.score.phase2_total} />
            <ScoreCell label="Final" value={result.score.final_total} />
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Aún no hay puntajes publicados para tu postulación.
          </div>
        )}

        {/* Payment */}
        {paymentRequired ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-extrabold text-slate-800">Terminar Admisión</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Monto: <span className="font-bold">S/ {paymentAmount}</span>
                {" · "}Estado: <span className="font-semibold">{paymentStatus}</span>
              </p>
            </div>
            <Button
              size="sm"
              className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full"
              onClick={onUploadVoucher}
            >
              <Upload size={13} /> Subir voucher
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Pago: <span className="font-semibold text-slate-700">No requerido</span>
            {" · "}Monto: S/ {paymentAmount}
            {" · "}Estado: {paymentStatus}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */
const PublicAdmissionCalls = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchData, setSearchData] = useState({ admissionCallId: "", documentNumber: "" });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedCallForDetails, setSelectedCallForDetails] = useState(null);
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [openApplyModal, setOpenApplyModal] = useState(false);
  const [selectedCallForApply, setSelectedCallForApply] = useState(null);
  const [openFinishModal, setOpenFinishModal] = useState(false);
  const [voucherFile, setVoucherFile] = useState(null);
  const [sendingVoucher, setSendingVoucher] = useState(false);

  const fetchPublicAdmissionCalls = useCallback(async () => {
    try {
      setLoading(true);
      const calls = await AdmissionCalls.listPublic();
      setAdmissionCalls(Array.isArray(calls) ? calls : []);
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error, "Error al cargar convocatorias"));
      setAdmissionCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPublicAdmissionCalls(); }, [fetchPublicAdmissionCalls]);

  const handleResultSearch = useCallback(async (e) => {
    e.preventDefault();
    const { admissionCallId, documentNumber } = searchData;
    if (!admissionCallId || !documentNumber) {
      toast.error("Por favor complete todos los campos");
      return;
    }
    setSearchLoading(true);
    setSearchResults(null);
    try {
      const { data } = await api.get(`/public/results/${admissionCallId}/${documentNumber}`);
      setSearchResults(data);
    } catch (error) {
      setSearchResults({
        error: error?.response?.status === 404
          ? "No se encontraron resultados para los datos ingresados."
          : formatApiError(error, "Error al consultar resultados."),
      });
    } finally {
      setSearchLoading(false);
    }
  }, [api, searchData]);

  const handleOpenReglamento = (call) => {
    const url = getReglamentoUrl(call);
    if (!url) return toast.error("Esta convocatoria no tiene reglamento cargado.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleViewDetails = (call) => { setSelectedCallForDetails(call); setOpenDetailsModal(true); };
  const handleApply = (call) => { setSelectedCallForApply(call); setOpenApplyModal(true); };
  const handleOpenApplyChange = (open) => { setOpenApplyModal(open); if (!open) setSelectedCallForApply(null); };
  const handleOpenDetailsChange = (open) => { setOpenDetailsModal(open); if (!open) setSelectedCallForDetails(null); };
  const handleOpenFinish = () => { setVoucherFile(null); setOpenFinishModal(true); };

  const uploadVoucher = async () => {
    if (!searchResults?.application_id) return toast.error("No hay postulación.");
    if (!voucherFile) return toast.error("Seleccione su voucher.");
    try {
      setSendingVoucher(true);
      const form = new FormData();
      form.append("application_id", String(searchResults.application_id));
      form.append("voucher", voucherFile);
      await api.post("/public/payments/voucher", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Voucher enviado. Se validará tu pago.");
      setOpenFinishModal(false);
      const callId = searchResults.call_id ?? searchData.admissionCallId;
      const dni = searchResults.applicant?.dni ?? searchData.documentNumber;
      if (callId && dni) {
        const { data } = await api.get(`/public/results/${callId}/${dni}`);
        setSearchResults(data);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo enviar el voucher");
    } finally {
      setSendingVoucher(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 font-medium">Cargando portal…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-800">

        {/* ── Header ── */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-700 border-b border-white/10 sticky top-0 z-50">
          <div className="w-full px-6 py-4 md:px-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img src="/logo.png" alt="Logo Institucional" className="h-14 w-auto object-contain shrink-0" />
              <div className="hidden md:block h-10 w-px bg-white/20 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  Portal de Admisión
                </h1>
                <p className="text-sm text-white/75 font-medium">
                  IESPP "Gustavo Allende Llavería"
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Volver"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
            <Button
              type="button" variant="ghost"
              onClick={() => (window.location.href = "/login")}
              className="text-white hover:text-white hover:bg-white/15 font-semibold shrink-0 rounded-xl hidden sm:flex"
            >
              Acceso al Sistema
            </Button>
          </div>
        </header>

        {/* ── Main ── */}
        <div className="w-full px-4 sm:px-6 py-8 md:px-12 flex-1">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* ── Left: Calls list ── */}
            <div className="xl:col-span-2 space-y-6">
              {/* Section title */}
              <div className="border-l-4 border-blue-600 pl-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Convocatorias de Admisión
                </h2>
                <p className="text-slate-500 mt-1 text-base">
                  Explore nuestras oportunidades académicas y postule hoy mismo.
                </p>
              </div>

              {admissionCalls.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center mx-auto">
                    <Calendar className="h-8 w-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-700">No hay convocatorias activas</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                      Actualmente no contamos con procesos de admisión abiertos. Revise nuevamente más tarde.
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl"
                    onClick={fetchPublicAdmissionCalls}>
                    Reintentar
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {admissionCalls.map((call) => (
                    <CallCard
                      key={call.id}
                      call={call}
                      onDetails={handleViewDetails}
                      onReglamento={handleOpenReglamento}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-6">

              {/* Consultar resultados */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden sticky top-24">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/40 to-white">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 grid place-items-center">
                      <Search size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-none">Consultar Resultados</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Ingresa tus datos para ver tu estado</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <form onSubmit={handleResultSearch} className="space-y-4">
                    {/* Select convocatoria */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Convocatoria
                      </Label>
                      <div className="relative">
                        <select
                          className="w-full h-11 px-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                          value={searchData.admissionCallId}
                          onChange={(e) => setSearchData(p => ({ ...p, admissionCallId: e.target.value }))}
                          required
                        >
                          <option value="">Seleccionar convocatoria…</option>
                          {admissionCalls.map((call) => (
                            <option key={call.id} value={call.id}>{call.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* DNI */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Documento de Identidad
                      </Label>
                      <Input
                        inputMode="numeric" pattern="[0-9]{8,12}" maxLength={12}
                        placeholder="Ej. 70123456"
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-mono"
                        value={searchData.documentNumber}
                        onChange={(e) => setSearchData(p => ({ ...p, documentNumber: e.target.value.trim() }))}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={searchLoading}
                      className="w-full h-11 rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {searchLoading
                        ? <><Loader2 size={15} className="animate-spin" /> Verificando…</>
                        : <><Search size={15} /> Consultar ahora</>
                      }
                    </Button>
                  </form>

                  {searchResults && (
                    <SearchResult result={searchResults} onUploadVoucher={handleOpenFinish} />
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                    Contacto Directo
                  </h4>
                </div>
                <div className="p-5 space-y-3.5">
                  {[
                    { icon: MapPin, text: "Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín, Perú" },
                    { icon: Phone, text: "+51 64 621199" },
                    { icon: Mail, text: "admin@iesppallende.edu.pe" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 grid place-items-center shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Subir voucher ── */}
      <Dialog open={openFinishModal} onOpenChange={setOpenFinishModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Terminar Admisión</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Monto a pagar:{" "}
                <span className="font-extrabold text-slate-900">
                  S/ {Number(searchResults?.payment?.amount || 0).toFixed(2)}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Adjunte el voucher de pago. El área de admisión validará el monto.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Voucher (imagen o PDF)</Label>
              <Input
                type="file" accept="image/*,application/pdf"
                className="rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold file:text-xs file:px-3 file:py-1.5 cursor-pointer"
                onChange={(e) => setVoucherFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-xl font-bold"
                onClick={() => setOpenFinishModal(false)} disabled={sendingVoucher}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={uploadVoucher}
                disabled={sendingVoucher || !voucherFile}
              >
                {sendingVoucher
                  ? <><Loader2 size={14} className="animate-spin" /> Enviando…</>
                  : <><Upload size={14} /> Enviar voucher</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Detalles ── */}
      <Dialog open={openDetailsModal} onOpenChange={handleOpenDetailsChange}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Detalles de la Convocatoria</DialogTitle>
          </DialogHeader>
          {selectedCallForDetails && (
            <PublicAdmissionCallDetails
              call={selectedCallForDetails}
              onOpenReglamento={() => handleOpenReglamento(selectedCallForDetails)}
              onApply={() => {
                setOpenDetailsModal(false);
                handleApply(selectedCallForDetails);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Postular ── */}
      <Dialog open={openApplyModal} onOpenChange={handleOpenApplyChange}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Postulación</DialogTitle>
          </DialogHeader>
          {selectedCallForApply && (
            <ApplicationWizard
              callId={selectedCallForApply.id}
              onClose={() => {
                handleOpenApplyChange(false);
                fetchPublicAdmissionCalls();
              }}
              onApplied={(updatedCall) => {
                setAdmissionCalls(prev =>
                  prev.map(c => String(c.id) === String(updatedCall.id) ? updatedCall : c)
                );
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublicAdmissionCalls;