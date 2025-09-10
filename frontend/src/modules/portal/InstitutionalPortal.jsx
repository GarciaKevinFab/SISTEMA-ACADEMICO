import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import {
  School,
  BookOpen,
  Users,
  Award,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  Download,
  ExternalLink,
  Star,
  ChevronRight,
  Play,
  Image as ImageIcon,
  Clock,
  User,
  Building
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

// Hero Section Component
const HeroSection = () => {
  return (
    <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2">
                Excelencia Educativa desde 1985
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Instituto de Educación Superior Pedagógico Público
                <span className="text-blue-300 block mt-2">
                  "Gustavo Allende Llavería"
                </span>
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                Formamos profesionales de la educación con excelencia académica,
                valores éticos y compromiso social para transformar la realidad educativa del país.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4">
                <Users className="h-5 w-5 mr-2" />
                Postular Ahora
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-900 px-8 py-4">
                <Play className="h-5 w-5 mr-2" />
                Ver Video Institucional
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold">39</div>
                <div className="text-blue-200 text-sm">Años de Experiencia</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">2,500+</div>
                <div className="text-blue-200 text-sm">Egresados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">98%</div>
                <div className="text-blue-200 text-sm">Inserción Laboral</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent rounded-2xl"></div>
              <img
                src="/api/placeholder/600/500"
                alt="Campus IESPP Gustavo Allende Llavería"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <h3 className="text-2xl font-bold mb-2">Campus Moderno</h3>
                <p className="text-blue-100">Instalaciones equipadas con tecnología de vanguardia</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Programs Section Component
const ProgramsSection = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const response = await axios.get(`${API}/careers`);
      setPrograms(response.data.careers || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultPrograms = [
    {
      id: '1',
      name: 'Educación Inicial',
      description: 'Formación integral para educadores de niños de 0 a 5 años',
      duration_years: 5,
      modality: 'Presencial'
    },
    {
      id: '2',
      name: 'Educación Primaria',
      description: 'Preparación de docentes para la educación básica regular',
      duration_years: 5,
      modality: 'Presencial'
    },
    {
      id: '3',
      name: 'Educación Física',
      description: 'Formación de profesores en educación física y deportes',
      duration_years: 5,
      modality: 'Presencial'
    },
    {
      id: '4',
      name: 'Educación Especial',
      description: 'Especialización en educación inclusiva y necesidades especiales',
      duration_years: 5,
      modality: 'Presencial'
    }
  ];

  const displayPrograms = programs.length > 0 ? programs : defaultPrograms;

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Nuestros Programas de Estudio
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ofrecemos carreras pedagógicas de calidad, acreditadas y diseñadas
            para formar los mejores profesionales de la educación
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {displayPrograms.map((program) => (
              <Card key={program.id} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <BookOpen className="h-8 w-8 text-blue-600" />
                    </div>
                    <Badge variant="secondary">{program.duration_years} años</Badge>
                  </div>
                  <CardTitle className="text-xl">{program.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {program.description}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-2" />
                      {program.duration_years} años de estudio
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-4 w-4 mr-2" />
                      Modalidad: {program.modality || 'Presencial'}
                    </div>
                  </div>

                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Ver Más Información
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            Ver Todos los Programas
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

// News and Announcements Section
const NewsSection = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading news
    setTimeout(() => {
      setNews([
        {
          id: '1',
          title: 'Inicio del Proceso de Admisión 2024-II',
          excerpt: 'Se abrieron las inscripciones para el segundo proceso de admisión del año académico 2024.',
          date: '2024-06-15',
          category: 'Admisión',
          image: '/api/placeholder/400/200'
        },
        {
          id: '2',
          title: 'Ceremonia de Graduación 2024',
          excerpt: 'Felicitamos a nuestros egresados de la promoción 2024 en una emotiva ceremonia.',
          date: '2024-06-10',
          category: 'Ceremonias',
          image: '/api/placeholder/400/200'
        },
        {
          id: '3',
          title: 'Nuevas Certificaciones Internacionales',
          excerpt: 'El instituto obtuvo certificación internacional en metodologías educativas innovadoras.',
          date: '2024-06-05',
          category: 'Logros',
          image: '/api/placeholder/400/200'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Noticias y Anuncios
          </h2>
          <p className="text-xl text-gray-600">
            Mantente informado sobre las últimas novedades de nuestra institución
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {news.map((article) => (
              <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="relative">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-48 object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-blue-600">
                    {article.category}
                  </Badge>
                </div>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(article.date).toLocaleDateString('es-PE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-gray-600 line-clamp-3">
                      {article.excerpt}
                    </p>

                    <Button variant="outline" className="w-full">
                      Leer Más
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            Ver Todas las Noticias
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

// Contact and Information Section
const ContactSection = () => {
  return (
    <section className="py-20 bg-gray-900 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                Contáctanos
              </h2>
              <p className="text-xl text-gray-300">
                Estamos aquí para ayudarte. Contáctanos para obtener más información
                sobre nuestros programas académicos.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Dirección</h3>
                  <p className="text-gray-300">
                    Jr. Ancash 123, Cercado de Lima<br />
                    Lima 15001, Perú
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Teléfonos</h3>
                  <p className="text-gray-300">
                    Central: (01) 426-2573<br />
                    Admisión: (01) 426-2574
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Correos Electrónicos</h3>
                  <p className="text-gray-300">
                    informes@iesppgal.edu.pe<br />
                    admision@iesppgal.edu.pe
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Horario de Atención</h3>
                  <p className="text-gray-300">
                    Lunes a Viernes: 8:00 AM - 6:00 PM<br />
                    Sábados: 8:00 AM - 1:00 PM
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Síguenos en Redes Sociales</h3>
              <div className="flex space-x-4">
                <Button size="sm" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
                  Facebook
                </Button>
                <Button size="sm" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
                  Instagram
                </Button>
                <Button size="sm" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
                  LinkedIn
                </Button>
                <Button size="sm" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
                  YouTube
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <Card className="bg-white text-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-blue-600" />
                  Envíanos un Mensaje
                </CardTitle>
                <CardDescription>
                  Completa el formulario y nos pondremos en contacto contigo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" placeholder="Tu nombre" />
                  </div>
                  <div>
                    <Label htmlFor="surname">Apellidos</Label>
                    <Input id="surname" placeholder="Tus apellidos" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" placeholder="tu@correo.com" />
                </div>

                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" placeholder="999 999 999" />
                </div>

                <div>
                  <Label htmlFor="subject">Asunto</Label>
                  <Input id="subject" placeholder="Asunto de tu consulta" />
                </div>

                <div>
                  <Label htmlFor="message">Mensaje</Label>
                  <textarea
                    id="message"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Escribe tu mensaje aquí..."
                  ></textarea>
                </div>

                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Enviar Mensaje
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

// Quick Access Section
const QuickAccessSection = () => {
  const { user } = useContext(AuthContext);

  return (
    <section className="py-20 bg-blue-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Acceso Rápido
          </h2>
          <p className="text-xl text-gray-600">
            Accede fácilmente a los servicios digitales de nuestra institución
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="text-center hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-8">
              <div className="p-4 bg-blue-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Portal del Estudiante</h3>
              <p className="text-gray-600 mb-6">
                Accede a tus notas, horarios y trámites académicos
              </p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                {user ? 'Ir al Portal' : 'Iniciar Sesión'}
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-8">
              <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <FileText className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Mesa de Partes Virtual</h3>
              <p className="text-gray-600 mb-6">
                Realiza trámites digitales y consulta su estado
              </p>
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Acceder
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-8">
              <div className="p-4 bg-purple-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Award className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Proceso de Admisión</h3>
              <p className="text-gray-600 mb-6">
                Consulta convocatorias y resultados de admisión
              </p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Consultar
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-8">
              <div className="p-4 bg-orange-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Download className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Biblioteca Virtual</h3>
              <p className="text-gray-600 mb-6">
                Accede a recursos digitales y materiales de estudio
              </p>
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                Explorar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

// Main Institutional Portal Component
const InstitutionalPortal = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <School className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">IESPP</h1>
                  <p className="text-xs text-gray-500">"Gustavo Allende Llavería"</p>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a href="#inicio" className="text-gray-700 hover:text-blue-600 font-medium">Inicio</a>
              <a href="#programas" className="text-gray-700 hover:text-blue-600 font-medium">Programas</a>
              <a href="#admision" className="text-gray-700 hover:text-blue-600 font-medium">Admisión</a>
              <a href="#noticias" className="text-gray-700 hover:text-blue-600 font-medium">Noticias</a>
              <a href="#contacto" className="text-gray-700 hover:text-blue-600 font-medium">Contacto</a>
            </nav>

            <div className="flex items-center space-x-4">
              <Button variant="outline" className="hidden md:block">
                Portal Estudiante
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Acceso Sistema
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <HeroSection />
        <ProgramsSection />
        <QuickAccessSection />
        <NewsSection />
        <ContactSection />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <School className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold">IESPP</h3>
                  <p className="text-sm text-gray-400">"Gustavo Allende Llavería"</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm">
                Formando profesionales de la educación con excelencia
                académica y compromiso social desde 1985.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Programas</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Educación Inicial</a></li>
                <li><a href="#" className="hover:text-white">Educación Primaria</a></li>
                <li><a href="#" className="hover:text-white">Educación Física</a></li>
                <li><a href="#" className="hover:text-white">Educación Especial</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Servicios</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Portal Estudiante</a></li>
                <li><a href="#" className="hover:text-white">Mesa de Partes</a></li>
                <li><a href="#" className="hover:text-white">Biblioteca Virtual</a></li>
                <li><a href="#" className="hover:text-white">Admisión</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Contacto</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>Jr. Ancash 123, Lima</p>
                <p>(01) 426-2573</p>
                <p>informes@iesppgal.edu.pe</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería". Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InstitutionalPortal;