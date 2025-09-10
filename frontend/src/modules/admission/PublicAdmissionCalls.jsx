// src/components/PublicAdmissionCalls.jsx
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
  Users,
  FileText,
  Search,
  School,
  Award,
  MapPin,
  Phone,
  Mail,
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
  const { api } = useAuth(); // cliente axios centralizado con baseURL/interceptores
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
      // si fetchPublicAdmissionCalls devolvió un cleanup, lo ejecutamos
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

    if (!regStart || !regEnd) return <Badge variant="secondary">Por confirmar</Badge>;
    if (now < regStart) return <Badge variant="secondary">Próximamente</Badge>;
    if (now >= regStart && now <= regEnd) return <Badge className="bg-green-600">Inscripciones Abiertas</Badge>;
    return <Badge variant="outline">Cerrada</Badge>;
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "-");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <School className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portal de Admisión</h1>
                <p className="text-sm text-gray-600">IESPP &quot;Gustavo Allende Llavería&quot;</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => (window.location.href = "/login")}>
              Acceso al Sistema
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admission Calls List */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Convocatorias de Admisión</h2>
              <p className="text-gray-600 mb-6">
                Consulte las convocatorias activas y próximas para postular a nuestros programas de estudio.
              </p>
            </div>

            {admissionCalls.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay convocatorias activas</h3>
                  <p className="text-gray-500">Próximamente se publicarán nuevas convocatorias de admisión.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {admissionCalls.map((call) => (
                  <Card key={call.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{call.name}</CardTitle>
                          {call.description && <CardDescription>{call.description}</CardDescription>}
                        </div>
                        {getCallStatusBadge(call)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Key Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Inscripciones: {fmtDate(call.registration_start)} - {fmtDate(call.registration_end)}
                          </span>
                        </div>

                        {call.exam_date && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span>Examen: {fmtDate(call.exam_date)}</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Users className="h-4 w-4" />
                          <span>
                            Período: {call.academic_year}
                            {call.academic_period ? `-${call.academic_period}` : ""}
                          </span>
                        </div>

                        {call.application_fee > 0 && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <FileText className="h-4 w-4" />
                            <span>Costo: S/ {Number(call.application_fee).toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {/* Available Careers */}
                      {Array.isArray(call.careers) && call.careers.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Carreras Disponibles:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {call.careers.map((career) => (
                              <div key={career.id} className="flex items-center space-x-2 text-sm">
                                <Award className="h-4 w-4 text-blue-600" />
                                <span>{career.name}</span>
                                {call.career_vacancies?.[career.id] != null && (
                                  <span className="text-gray-500">
                                    ({call.career_vacancies[career.id]} vacantes)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Age Requirements */}
                      {(call.minimum_age != null || call.maximum_age != null) && (
                        <div className="text-sm text-gray-600">
                          <strong>Requisitos de edad:</strong>{" "}
                          {call.minimum_age ?? "-"} {call.maximum_age ? ` - ${call.maximum_age} años` : "años"}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-4">
                        <Button className="bg-blue-600 hover:bg-blue-700">Ver Detalles</Button>
                        <Button variant="outline">Descargar Reglamento</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Results Search Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Consultar Resultados</span>
                </CardTitle>
                <CardDescription>Ingrese sus datos para consultar los resultados de admisión</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResultSearch} className="space-y-4">
                  <div>
                    <Label htmlFor="admissionCall">Convocatoria</Label>
                    <select
                      id="admissionCall"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={searchData.admissionCallId}
                      onChange={(e) =>
                        setSearchData((prev) => ({ ...prev, admissionCallId: e.target.value }))
                      }
                      required
                    >
                      <option value="">Seleccione convocatoria</option>
                      {admissionCalls.map((call) => (
                        <option key={call.id} value={call.id}>
                          {call.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="documentNumber">Número de Documento</Label>
                    <Input
                      id="documentNumber"
                      inputMode="numeric"
                      pattern="[0-9]{8,12}"
                      maxLength={12}
                      placeholder="Ingrese su DNI"
                      value={searchData.documentNumber}
                      onChange={(e) =>
                        setSearchData((prev) => ({ ...prev, documentNumber: e.target.value.trim() }))
                      }
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Solo números, 8-12 dígitos.</p>
                  </div>

                  <Button type="submit" disabled={searchLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                    {searchLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Consultando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Consultar Resultados
                      </>
                    )}
                  </Button>
                </form>

                {/* Search Results */}
                {searchResults && (
                  <div className="mt-6 p-4 border rounded-lg">
                    {searchResults.error ? (
                      <div className="text-red-600 text-sm">{searchResults.error}</div>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Resultado de Admisión</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>Postulante:</strong> {searchResults.applicant_name || "-"}
                          </div>
                          <div>
                            <strong>DNI:</strong> {searchResults.document_number || "-"}
                          </div>
                          <div>
                            <strong>Carrera:</strong> {searchResults.career || "-"}
                          </div>
                          <div>
                            <strong>Puntaje:</strong> {searchResults.final_score ?? "-"}
                          </div>
                          <div>
                            <strong>Posición:</strong> {searchResults.position ?? "-"}
                          </div>
                          <div className="flex items-center">
                            <strong>Estado:</strong>
                            <Badge className={`ml-2 ${searchResults.is_admitted ? "bg-green-600" : "bg-red-600"}`}>
                              {searchResults.is_admitted ? "ADMITIDO" : "NO ADMITIDO"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span>Jr. Ancash 123, Cercado de Lima, Lima 15001</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span>(01) 426-2574</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span>admision@iesppgal.edu.pe</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicAdmissionCalls;
