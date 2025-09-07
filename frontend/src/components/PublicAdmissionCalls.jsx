import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
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
  Mail
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

const PublicAdmissionCalls = () => {
  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchData, setSearchData] = useState({
    admissionCallId: '',
    documentNumber: ''
  });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchPublicAdmissionCalls();
  }, []);

  const fetchPublicAdmissionCalls = async () => {
    try {
      const response = await axios.get(`${API}/portal/public/admission-calls`);
      setAdmissionCalls(response.data.admission_calls || []);
    } catch (error) {
      console.error('Error fetching admission calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultSearch = async (e) => {
    e.preventDefault();
    if (!searchData.admissionCallId || !searchData.documentNumber) {
      alert('Por favor complete todos los campos');
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get(
        `${API}/admission-results/public/${searchData.admissionCallId}/${searchData.documentNumber}`
      );
      setSearchResults(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setSearchResults({ error: 'No se encontraron resultados para los datos ingresados.' });
      } else {
        setSearchResults({ error: 'Error al consultar resultados. Intente nuevamente.' });
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const getCallStatusBadge = (call) => {
    const now = new Date();
    const regStart = new Date(call.registration_start);
    const regEnd = new Date(call.registration_end);
    
    if (now < regStart) {
      return <Badge variant="secondary">Próximamente</Badge>;
    } else if (now >= regStart && now <= regEnd) {
      return <Badge className="bg-green-600">Inscripciones Abiertas</Badge>;
    } else {
      return <Badge variant="outline">Cerrada</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                <h1 className="text-2xl font-bold text-gray-900">
                  Portal de Admisión
                </h1>
                <p className="text-sm text-gray-600">
                  IESPP "Gustavo Allende Llavería"
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/login'}>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Convocatorias de Admisión
              </h2>
              <p className="text-gray-600 mb-6">
                Consulte las convocatorias activas y próximas para postular a nuestros programas de estudio.
              </p>
            </div>

            {admissionCalls.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No hay convocatorias activas
                  </h3>
                  <p className="text-gray-500">
                    Próximamente se publicarán nuevas convocatorias de admisión.
                  </p>
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
                          <CardDescription>{call.description}</CardDescription>
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
                            Inscripciones: {new Date(call.registration_start).toLocaleDateString()} - {new Date(call.registration_end).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {call.exam_date && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span>
                              Examen: {new Date(call.exam_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Users className="h-4 w-4" />
                          <span>Período: {call.academic_year}-{call.academic_period}</span>
                        </div>
                        
                        {call.application_fee > 0 && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <FileText className="h-4 w-4" />
                            <span>Costo: S/ {call.application_fee}</span>
                          </div>
                        )}
                      </div>

                      {/* Available Careers */}
                      {call.careers && call.careers.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Carreras Disponibles:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {call.careers.map((career) => (
                              <div key={career.id} className="flex items-center space-x-2 text-sm">
                                <Award className="h-4 w-4 text-blue-600" />
                                <span>{career.name}</span>
                                {call.career_vacancies && call.career_vacancies[career.id] && (
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
                      <div className="text-sm text-gray-600">
                        <strong>Requisitos de edad:</strong> {call.minimum_age} - {call.maximum_age} años
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-4">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          Ver Detalles
                        </Button>
                        <Button variant="outline">
                          Descargar Reglamento
                        </Button>
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
                <CardDescription>
                  Ingrese sus datos para consultar los resultados de admisión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResultSearch} className="space-y-4">
                  <div>
                    <Label htmlFor="admissionCall">Convocatoria</Label>
                    <select
                      id="admissionCall"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={searchData.admissionCallId}
                      onChange={(e) => setSearchData({...searchData, admissionCallId: e.target.value})}
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
                      placeholder="Ingrese su DNI"
                      value={searchData.documentNumber}
                      onChange={(e) => setSearchData({...searchData, documentNumber: e.target.value})}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={searchLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {searchLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                      <div className="text-red-600 text-sm">
                        {searchResults.error}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">
                          Resultado de Admisión
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Postulante:</strong> {searchResults.applicant_name}</div>
                          <div><strong>DNI:</strong> {searchResults.document_number}</div>
                          <div><strong>Carrera:</strong> {searchResults.career}</div>
                          <div><strong>Puntaje:</strong> {searchResults.final_score}</div>
                          <div><strong>Posición:</strong> {searchResults.position}</div>
                          <div>
                            <strong>Estado:</strong>
                            <Badge 
                              className={`ml-2 ${
                                searchResults.is_admitted ? 'bg-green-600' : 'bg-red-600'
                              }`}
                            >
                              {searchResults.is_admitted ? 'ADMITIDO' : 'NO ADMITIDO'}
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