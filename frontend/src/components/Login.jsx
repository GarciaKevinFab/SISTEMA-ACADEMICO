import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Login = () => {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await login(formData.username, formData.password);

      if (res?.mfa_required) {
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-cover bg-center"
      style={{ backgroundImage: "url('/bg-login.png')" }}
    >
      {/* Capa oscura con blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      {/* Caja del login */}
      <div className="relative max-w-4xl w-full bg-white/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl flex flex-col md:flex-row border border-white/40">
        
        {/* BOTÓN VOLVER */}
        <button 
          onClick={() => navigate("/")} 
          className="absolute top-4 left-4 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors z-10"
        >
          <ArrowLeft size={20} />
          <span>Volver</span>
        </button>

        {/* --- LOGO AGRANDADO --- */}
        <div className="w-full md:w-1/3 flex justify-center items-center mb-8 md:mb-0">
          <img
            src="/logo.png"
            alt="Logo del Instituto"
            // CAMBIO: Aumenté el tamaño móvil (w-[180px]) y la altura en escritorio (md:h-[220px])
            className="object-contain w-[180px] md:w-full h-auto md:h-[220px]"
          />
        </div>

        {/* Formulario */}
        <div className="w-full md:w-2/3 space-y-8 px-6">
          <h2 className="text-center text-3xl font-extrabold text-gray-900 font-montserrat">
            SISTEMA ACADEMICO
          </h2>

          <p className="text-center text-sm text-gray-600 font-roboto">
            IESPP "Gustavo Allende Llavería"
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Usuario"
                  value={formData.username}
                  onChange={handleChange}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border 
                             border-gray-300 placeholder-gray-500 text-gray-900 
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 
                             focus:border-indigo-500 sm:text-sm mb-4"
                />
              </div>
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Contraseña"
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border 
                             border-gray-300 placeholder-gray-500 text-gray-900 
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 
                             focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center mt-2 bg-red-50 py-1 rounded">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-2.5 px-4 border 
                            border-transparent text-sm font-bold rounded-md text-white shadow-md
                            transition-all duration-200 ease-in-out
                            ${loading
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            }`}
              >
                {loading ? "Iniciando..." : "Iniciar Sesión"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;