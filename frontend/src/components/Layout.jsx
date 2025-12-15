import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import { AuthContext } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <SideNav />

      <div className="flex-1 flex flex-col">

        {/* HEADER MEJORADO */}
        <header className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 shadow-md border-b border-white/10">
          <div className="px-6 py-4 flex items-center justify-between">

            {/* Izquierda: título + subtítulo */}
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Sistema Académico
              </h1>
              <p className="text-sm text-blue-100 mt-1">
                Bienvenido,&nbsp;
                <span className="font-medium text-white">
                  {user.full_name}
                </span>
              </p>
            </div>

            {/* Derecha: Fecha + iniciales */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-blue-100 hidden sm:block">
                {new Date().toLocaleDateString('es-PE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>

              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center text-blue-700 font-bold shadow">
                {user.full_name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            </div>

          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 overflow-auto p-4">
          {children || <Outlet />}
        </main>

      </div>
    </div>
  );
};

export default Layout;
