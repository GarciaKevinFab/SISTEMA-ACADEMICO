import React from "react";

const Landing = () => {
    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="bg-blue-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <img
                                    className="h-12 w-12"
                                    src="/logo.png" // Ruta de la imagen del logo
                                    alt="Logo del Instituto"
                                />
                            </div>
                            <div className="ml-4">
                                <h1 className="text-2xl font-bold text-white">IESPP Gustavo Allende Llavería</h1>
                                <p className="text-blue-200">Sistema Académico Integral</p>
                            </div>
                        </div>
                        <nav className="hidden md:flex space-x-8">
                            <a href="#inicio" className="text-blue-200 hover:text-white">Inicio</a>
                            <a href="#nosotros" className="text-blue-200 hover:text-white">Nosotros</a>
                            <a href="#carreras" className="text-blue-200 hover:text-white">Carreras</a>
                            <a href="#admision" className="text-blue-200 hover:text-white">Admisión</a>
                            <a href="#contacto" className="text-blue-200 hover:text-white">Contacto</a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section
                id="inicio"
                className="bg-cover bg-center relative h-[500px] flex items-center justify-center"
                style={{
                    backgroundImage: "url('/gustavo_portada.png')", // Ruta de la imagen de fondo
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                }}
            >
                <div className="absolute inset-0 bg-black opacity-40 z-0"></div> {/* Filtro oscuro para mejorar contraste */}
                <div className="z-10 text-center text-white">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                        <span className="block">Formando</span>
                        <span className="block text-indigo-200">Educadores de Excelencia</span>
                    </h1>
                    <p className="mt-3 max-w-md mx-auto text-base text-indigo-200 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                        Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería" -
                        Comprometidos con la formación integral de futuros docentes.
                    </p>
                    <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
                        <div className="rounded-md shadow">
                            <a
                                href="/public/admission"
                                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 md:py-4 md:text-lg md:px-10"
                            >
                                Ver Convocatorias
                            </a>
                        </div>
                        <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                            <a
                                href="/login"
                                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
                            >
                                Acceso al Sistema
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Careers */}
            <section id="carreras" className="py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="lg:text-center mb-12">
                        <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Programas de Estudio</h2>
                        <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                            Carreras Profesionales
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-6">
                                <h3 className="text-lg font-medium text-gray-900">Educación Inicial</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Forma docentes especializados en la educación de niños de 0 a 5 años.
                                </p>
                                <div className="mt-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        10 semestres
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-6">
                                <h3 className="text-lg font-medium text-gray-900">Educación Primaria</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Prepara educadores para la enseñanza integral de niños de 6 a 12 años.
                                </p>
                                <div className="mt-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        10 semestres
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-6">
                                <h3 className="text-lg font-medium text-gray-900">Educación Física</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Forma profesionales en educación física y promoción de la salud.
                                </p>
                                <div className="mt-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        10 semestres
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Admisión */}
            <section id="admision" className="bg-indigo-700">
                <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                        <span className="block">¿Listo para ser parte</span>
                        <span className="block">de nuestra comunidad?</span>
                    </h2>
                    <p className="mt-4 text-lg leading-6 text-indigo-200">
                        Únete a nosotros y forma parte de la nueva generación de educadores que transformarán el futuro de la educación.
                    </p>
                    <a
                        href="/public/admission"
                        className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 sm:w-auto"
                    >
                        Postular Ahora
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-800">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center">
                                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-white font-bold">IESPP Gustavo Allende Llavería</p>
                                </div>
                            </div>
                            <p className="mt-4 text-gray-300 text-sm">
                                Instituto de Educación Superior Pedagógico Público comprometido con la formación de educadores de excelencia.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Contacto</h3>
                            <div className="mt-4 space-y-2">
                                <p className="text-gray-300 text-sm">Jr. Ejemplo 123, Lima, Perú</p>
                                <p className="text-gray-300 text-sm">+51 1 234-5678</p>
                                <p className="text-gray-300 text-sm">info@iesppgal.edu.pe</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Enlaces</h3>
                            <div className="mt-4 space-y-2">
                                <a href="#" className="text-gray-300 hover:text-white text-sm block">Inicio</a>
                                <a href="#" className="text-gray-300 hover:text-white text-sm block">Nosotros</a>
                                <a href="#" className="text-gray-300 hover:text-white text-sm block">Carreras</a>
                                <a href="#" className="text-gray-300 hover:text-white text-sm block">Admisión</a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-gray-700 pt-8">
                        <p className="text-gray-400 text-sm text-center">
                            © 2024 IESPP Gustavo Allende Llavería. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
