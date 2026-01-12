import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { 
  Calendar,
  Clock,
  FileText,
  Search,
  Award,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  School,
  ArrowLeft 
} from "lucide-react";

import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d
        .map((e) => {
          const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
          return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
        })
        .filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

const PublicAdmissionCalls = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchData, setSearchData] = useState({ admissionCallId: "", documentNumber: "" });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

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

  useEffect(() => {
    fetchPublicAdmissionCalls();
  }, [fetchPublicAdmissionCalls]);

  const handleResultSearch = useCallback(
  async (e) => {
    e.preventDefault();

    const { admissionCallId, documentNumber } = searchData;

    if (!admissionCallId || !documentNumber) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    setSearchLoading(true);
    setSearchResults(null);

    try {
      const { data } = await api.get(
        `/admission-results/public/${admissionCallId}/${documentNumber}`
      );
      setSearchResults(data);
    } catch (error) {
      if (error?.response?.status === 404) {
        setSearchResults({
          error: "No se encontraron resultados para los datos ingresados.",
        });
      } else {
        setSearchResults({
          error: formatApiError(
            error,
            "Error al consultar resultados."
          ),
        });
      }
    } finally {
      setSearchLoading(false);
    }
  },
  [api, searchData]
);


  const getCallStatusBadge = (call) => {
    const now = new Date();
    const regStart = call?.registration_start ? new Date(call.registration_start) : null;
    const regEnd = call?.registration_end ? new Date(call.registration_end) : null;

    const badgeClass = "rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm";

    if (!regStart || !regEnd) {
      return (
        <Badge variant="secondary" className={badgeClass}>
          POR CONFIRMAR
        </Badge>
      );
    }

    if (now < regStart) {
      return (
        <Badge variant="secondary" className={`bg-blue-50 text-blue-700 hover:bg-blue-100 ${badgeClass}`}>
          PRÓXIMAMENTE
        </Badge>
      );
    }

    if (now >= regStart && now <= regEnd) {
      return (
        <Badge className={`bg-emerald-600 hover:bg-emerald-700 ${badgeClass}`}>
          INSCRIPCIONES ABIERTAS
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className={`text-gray-500 border-gray-300 ${badgeClass}`}>
        CERRADA
      </Badge>
    );
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const getReglamentoUrl = (call) => {
    const candidate =
      call?.regulation_url ||
      call?.reglamento_url ||
      call?.rules_url ||
      call?.regulationPdf ||
      call?.regulation_pdf ||
      call?.reglamento_pdf ||
      call?.documents?.reglamento ||
      call?.documents?.rules ||
      null;

    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  };

  const handleOpenReglamento = (call) => {
    const url = getReglamentoUrl(call);
    if (!url) return toast.error("Esta convocatoria no tiene reglamento cargado.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleViewDetails = (call) => {
    if (!call?.id) return toast.error("No se pudo abrir el detalle: falta el ID.");
    navigate(`/public/admission/${call.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Cargando portal...</p>
        </div>
      </div>
    );
  }

 return (
  <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-800">
  <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div className="w-full px-6 py-4 md:px-12 flex items-center justify-between">

      {/* IZQUIERDA: Logo + Título + Volver */}
      <div className="flex items-center gap-4 min-w-0">

        {/* LOGO */}
        <img
          src="/logo.png"
          alt="Logo Institucional"
          className="h-14 w-auto object-contain shrink-0"
        />

        <div className="hidden md:block h-10 w-px bg-gray-200"></div>

        {/* TÍTULO */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
  Portal de Admisión
</h1>
<p className="text-sm text-white/80 font-medium tracking-wide">
  IESPP "Gustavo Allende Llavería"
</p>

        </div>

        {/* BOTÓN VOLVER (a la derecha del título, sin romper layout) */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ml-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
          aria-label="Volver"
          title="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* DERECHA: Acceso al sistema */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => (window.location.href = "/login")}
        className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-medium shrink-0"
      >
        Acceso al Sistema
      </Button>

    </div>
  </header>


      <div className="w-full px-6 py-10 md:px-12 flex-1">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 h-full">
          <div className="xl:col-span-2 space-y-8">
            <div className="border-l-4 border-blue-600 pl-4">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Convocatorias de Admisión</h2>
              <p className="text-slate-600 mt-1 text-lg">Explore nuestras oportunidades académicas y postule hoy mismo.</p>
            </div>

            {admissionCalls.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 bg-transparent shadow-none">
                <CardContent className="p-12 text-center">
                  <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No hay convocatorias activas</h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Actualmente no contamos con procesos de admisión abiertos. Revise nuevamente más tarde.
                  </p>
                  <div className="mt-6">
                    <Button type="button" variant="outline" onClick={fetchPublicAdmissionCalls}>
                      Reintentar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-6">
                {admissionCalls.map((call) => (
                  <Card key={call.id} className="border border-gray-200 shadow-sm hover:shadow-xl transition-all rounded-xl overflow-hidden bg-white">
                    <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-slate-800">{call.name}</CardTitle>
                        {call.description && <CardDescription className="text-slate-500 text-base">{call.description}</CardDescription>}
                      </div>
                      <div className="shrink-0">{getCallStatusBadge(call)}</div>
                    </div>

                    <CardContent className="px-8 py-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0"><Calendar className="h-4 w-4" /></div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inscripción</p>
                            <p className="text-sm font-medium text-slate-700">{fmtDate(call.registration_start)} - {fmtDate(call.registration_end)}</p>
                          </div>
                        </div>

                        {call.exam_date && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0"><Clock className="h-4 w-4" /></div>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Examen</p>
                              <p className="text-sm font-medium text-slate-700">{fmtDate(call.exam_date)}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0"><School className="h-4 w-4" /></div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Periodo</p>
                            <p className="text-sm font-medium text-slate-700">
                              {call.academic_year}{call.academic_period ? `-${call.academic_period}` : ""}
                            </p>
                          </div>
                        </div>

                        {Number(call.application_fee) > 0 && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0"><FileText className="h-4 w-4" /></div>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costo</p>
                              <p className="text-sm font-medium text-slate-700">S/ {Number(call.application_fee).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {!!(call.careers || []).length && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Award className="h-4 w-4 text-blue-600" />
                            Programas Disponibles
                          </h4>

                          <div className="flex flex-wrap gap-2">
                            {call.careers.map((career) => (
                              <div
                                key={String(career.id ?? career.career_id)}
                                className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200"
                              >
                                {career.name}
                                {career.vacancies != null && (
                                  <span className="ml-2 text-slate-400 text-xs border-l border-slate-300 pl-2">
                                    {career.vacancies} vac.
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 shrink-0">
                        <Button type="button" variant="outline" className="h-10 px-5" onClick={() => handleOpenReglamento(call)}>
                          Reglamento
                        </Button>
                        <Button type="button" className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleViewDetails(call)}>
                          Ver Detalles <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar igual */}
          <div className="space-y-8 mt-2 xl:mt-0">
            <Card className="border border-gray-200 shadow-lg rounded-xl overflow-hidden bg-white sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-slate-900">
                  <Search className="h-5 w-5 text-blue-600" />
                  <span>Consultar Resultados</span>
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Ingrese sus credenciales para verificar el estado de su admisión.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 pt-0">
                <form onSubmit={handleResultSearch} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="admissionCall" className="text-sm font-semibold text-slate-700">Convocatoria</Label>
                    <div className="relative">
                      <select
                        id="admissionCall"
                        className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg"
                        value={searchData.admissionCallId}
                        onChange={(e) => setSearchData((prev) => ({ ...prev, admissionCallId: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar convocatoria...</option>
                        {admissionCalls.map((call) => (
                          <option key={call.id} value={call.id}>{call.name}</option>
                        ))}
                      </select>
                      <ChevronRight className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="documentNumber" className="text-sm font-semibold text-slate-700">Documento de Identidad</Label>
                    <Input
                      id="documentNumber"
                      inputMode="numeric"
                      pattern="[0-9]{8,12}"
                      maxLength={12}
                      placeholder="Ej. 70123456"
                      className="h-11 bg-gray-50 border-gray-200"
                      value={searchData.documentNumber}
                      onChange={(e) => setSearchData((prev) => ({ ...prev, documentNumber: e.target.value.trim() }))}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={searchLoading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                    {searchLoading ? "Verificando..." : "Consultar Ahora"}
                  </Button>
                </form>

                {searchResults && (
                  <div className={`mt-6 p-5 rounded-lg border ${searchResults.error ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                    {searchResults.error ? (
                      <p className="text-red-600 text-sm">{searchResults.error}</p>
                    ) : (
                      <pre className="text-xs">{JSON.stringify(searchResults, null, 2)}</pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Contacto Directo</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <MapPin className="h-4 w-4 text-blue-600" /> Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín, Perú
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone className="h-4 w-4 text-blue-600" /> +51 64 621199
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail className="h-4 w-4 text-blue-600" /> admin@iesppallende.edu.pe
                </div>
              </div>
            </div>
          </div>
          {/* end sidebar */}
        </div>
      </div>
    </div>
  );
};

export default PublicAdmissionCalls;
