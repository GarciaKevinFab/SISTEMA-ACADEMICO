import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

// ------- helpers -------
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
  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchData, setSearchData] = useState({
    admissionCallId: "",
    documentNumber: "",
  });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchPublicAdmissionCalls = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      const { data } = await api.get("/portal/public/admission-calls");
      if (!cancelled) setAdmissionCalls(data?.admission_calls || []);
    } catch (error) {
      console.error("Error fetching admission calls:", error);
      toast.error(formatApiError(error, "Error al cargar convocatorias"));
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const cleanup = fetchPublicAdmissionCalls();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
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
            error: formatApiError(error, "Error al consultar resultados. Intente nuevamente."),
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

    if (!regStart || !regEnd) return <Badge variant="secondary" className={badgeClass}>POR CONFIRMAR</Badge>;
    if (now < regStart) return <Badge variant="secondary" className={`bg-blue-50 text-blue-700 hover:bg-blue-100 ${badgeClass}`}>PRÓXIMAMENTE</Badge>;
    if (now >= regStart && now <= regEnd) return <Badge className={`bg-emerald-600 hover:bg-emerald-700 ${badgeClass}`}>INSCRIPCIONES ABIERTAS</Badge>;
    return <Badge variant="outline" className={`text-gray-500 border-gray-300 ${badgeClass}`}>CERRADA</Badge>;
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-PE", { day: '2-digit', month: 'short', year: 'numeric' }) : "-");

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
      
      {/* Header Principal */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-6 py-4 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img 
              src="/logo.png" 
              alt="Logo Institucional" 
              className="h-14 w-auto object-contain transition-transform duration-300 hover:scale-105" 
            />
            <div className="hidden md:block h-10 w-px bg-gray-200"></div>
            <div>
              {/* CAMBIO AQUÍ: text-gray-500 para el color gris solicitado */}
              <h1 className="text-2xl font-bold text-white-500 tracking-tight leading-tight">Portal de Admisión</h1>
              <p className="text-sm text-slate-500 font-medium tracking-wide">IESPP "Gustavo Allende Llavería"</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={() => (window.location.href = "/login")} 
            className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-medium transition-colors"
          >
            Acceso al Sistema
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full px-6 py-10 md:px-12 flex-1">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 h-full">
          
          {/* Section: Convocatorias (Left side) */}
          <div className="xl:col-span-2 space-y-8">
            <div className="border-l-4 border-blue-600 pl-4">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Convocatorias de Admisión</h2>
              <p className="text-slate-600 mt-1 text-lg">
                Explore nuestras oportunidades académicas y postule hoy mismo.
              </p>
            </div>

            {admissionCalls.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 bg-transparent shadow-none">
                <CardContent className="p-12 text-center">
                  <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No hay convocatorias activas</h3>
                  <p className="text-slate-500 max-w-md mx-auto">Actualmente no contamos con procesos de admisión abiertos. Por favor, revise nuevamente más tarde.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-6">
                {admissionCalls.map((call) => (
                  <Card key={call.id} className="group border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden bg-white">
                    <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {call.name}
                        </CardTitle>
                        {call.description && <CardDescription className="text-slate-500 text-base">{call.description}</CardDescription>}
                      </div>
                      <div className="shrink-0">
                         {getCallStatusBadge(call)}
                      </div>
                    </div>

                    <CardContent className="px-8 py-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inscripción</p>
                            <p className="text-sm font-medium text-slate-700">{fmtDate(call.registration_start)} - {fmtDate(call.registration_end)}</p>
                          </div>
                        </div>

                        {call.exam_date && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Examen</p>
                                <p className="text-sm font-medium text-slate-700">{fmtDate(call.exam_date)}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                              <School className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Periodo</p>
                                <p className="text-sm font-medium text-slate-700">{call.academic_year}{call.academic_period ? `-${call.academic_period}` : ""}</p>
                            </div>
                        </div>

                        {call.application_fee > 0 && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costo</p>
                                <p className="text-sm font-medium text-slate-700">S/ {Number(call.application_fee).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-gray-100 w-full" />

                      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        {Array.isArray(call.careers) && call.careers.length > 0 && (
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <Award className="h-4 w-4 text-blue-600" />
                              Programas Disponibles
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {call.careers.map((career) => (
                                <div key={career.id} className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200">
                                  {career.name}
                                  {call.career_vacancies?.[career.id] != null && (
                                    <span className="ml-2 text-slate-400 text-xs border-l border-slate-300 pl-2">
                                      {call.career_vacancies[career.id]} vac.
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {(call.minimum_age != null || call.maximum_age != null) && (
                                <p className="text-xs text-slate-400 mt-2 ml-1">
                                  * Edad requerida: {call.minimum_age ?? "0"} a {call.maximum_age ? call.maximum_age : "sin límite"} años.
                                </p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-3 shrink-0">
                          <Button variant="outline" className="h-10 px-5 border-gray-300 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-lg">
                             Reglamento
                          </Button>
                          <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 rounded-lg transition-all transform active:scale-95">
                            Ver Detalles <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Resultados & Contacto (Right side) */}
          <div className="space-y-8 mt-2 xl:mt-0">
            
            {/* Tarjeta de Búsqueda de Resultados */}
            <Card className="border border-gray-200 shadow-lg shadow-gray-200/50 rounded-xl overflow-hidden bg-white sticky top-24">
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
                        className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer text-slate-700"
                        value={searchData.admissionCallId}
                        onChange={(e) =>
                            setSearchData((prev) => ({ ...prev, admissionCallId: e.target.value }))
                        }
                        required
                        >
                        <option value="">Seleccionar convocatoria...</option>
                        {admissionCalls.map((call) => (
                            <option key={call.id} value={call.id}>
                            {call.name}
                            </option>
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
                      className="h-11 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                      value={searchData.documentNumber}
                      onChange={(e) =>
                        setSearchData((prev) => ({ ...prev, documentNumber: e.target.value.trim() }))
                      }
                      required
                    />
                  </div>

                  <Button type="submit" disabled={searchLoading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md shadow-blue-200 transition-all">
                    {searchLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verificando...
                      </span>
                    ) : (
                      "Consultar Ahora"
                    )}
                  </Button>
                </form>

                {searchResults && (
                  <div className={`mt-6 p-5 rounded-lg border ${searchResults.error ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    {searchResults.error ? (
                      <div className="flex gap-3 text-red-600 text-sm">
                          <div className="shrink-0 mt-0.5">•</div>
                          <p>{searchResults.error}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Resultados</h4>
                            <Badge className={searchResults.is_admitted ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}>
                              {searchResults.is_admitted ? "ADMITIDO" : "NO ADMITIDO"}
                            </Badge>
                        </div>
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Postulante</span>
                            <span className="font-medium text-slate-900 text-right">{searchResults.applicant_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">DNI</span>
                            <span className="font-medium text-slate-900">{searchResults.document_number}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Carrera</span>
                            <span className="font-medium text-slate-900 text-right">{searchResults.career}</span>
                          </div>
                          <div className="bg-white p-3 rounded border border-gray-100 flex justify-between items-center mt-2">
                            <span className="text-slate-500 font-medium">Puntaje Final</span>
                            <span className="font-bold text-blue-700 text-lg">{searchResults.final_score ?? "-"}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 px-1">
                            <span>Orden de Mérito</span>
                            <span>#{searchResults.position ?? "-"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Contacto Directo</h4>
              <div className="space-y-4">
                <a href="#" className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-0.5">Sede Central</p>
                    <p className="text-sm text-slate-700 leading-snug">Jr. Ancash 123, Cercado de Lima</p>
                  </div>
                </a>
                
                <a href="tel:014262574" className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                     <p className="text-xs font-semibold text-slate-400 mb-0.5">Teléfono</p>
                     <p className="text-sm text-slate-700">(01) 426-2574</p>
                  </div>
                </a>

                <a href="mailto:admision@iesppgal.edu.pe" className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-0.5">Correo Electrónico</p>
                    <p className="text-sm text-slate-700">admision@iesppgal.edu.pe</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicAdmissionCalls;