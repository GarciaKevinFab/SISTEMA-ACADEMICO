import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import { AuthContext } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-slate-900">
      
      {/* NAVEGACIÓN LATERAL (Fija o adaptable según tu componente SideNav) */}
      <SideNav />

      {/* CONTENEDOR DERECHO */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">

        {/* HEADER MEJORADO 
            - Sticky: Se queda pegado arriba.
            - Z-Index: Se asegura de estar sobre el contenido.
            - Shadow: Sombra más difuminada y elegante.
        */}
        <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 shadow-lg shadow-blue-900/10 border-b border-white/10">
          <div className="px-6 py-4 flex items-center justify-between">

            {/* IZQUIERDA: Título y Bienvenida */}
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
                Sistema Académico
              </h1>
              <p className="text-sm text-blue-100/90 mt-0.5 font-medium flex items-center gap-1">
                Bienvenido, 
                <span className="text-white font-semibold tracking-wide">
                  {user.full_name}
                </span>
              </p>
            </div>

            {/* DERECHA: Fecha y Perfil */}
            <div className="flex items-center gap-6">
              {/* Fecha con estilo más limpio */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                  Hoy
                </span>
                <span className="text-sm font-medium text-white leading-tight capitalize">
                  {new Date().toLocaleDateString('es-PE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </span>
              </div>

              {/* Separador vertical sutil */}
              <div className="hidden sm:block h-8 w-px bg-white/20"></div>

              {/* Avatar Mejorado 
                  - Ring: Anillo semitransparente alrededor.
                  - Shadow: Sombra para dar profundidad.
                  - Hover: Pequeña escala al pasar el mouse.
              */}
              <div className="group relative cursor-pointer">
                <div className="h-11 w-11 rounded-full bg-white text-blue-700 flex items-center justify-center text-sm font-bold shadow-xl ring-2 ring-white/30 transition-transform duration-200 group-hover:scale-105 group-hover:ring-white/50">
                  {user.full_name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              </div>
            </div>

          </div>
        </header>

        {/* CONTENIDO PRINCIPAL 
            - animate-in: Suaviza la aparición del contenido.
            - p-6: Un poco más de espacio que p-4 para que respire.
        */}
        <main className="flex-1 overflow-auto p-4 md:p-6 animate-in fade-in duration-500">
          <div className="mx-auto w-full max-w-[1920px]">
             {children || <Outlet />}
          </div>
        </main>

      </div>
    </div>
  );
};

export default Layout;