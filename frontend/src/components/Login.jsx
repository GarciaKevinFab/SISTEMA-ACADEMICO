import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const Login = () => {
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { login } = useAuth();

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
            <div className="relative max-w-4xl w-full bg-white/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl flex border border-white/40">
                
                {/* Logo */}
                <div className="w-1/3 flex justify-center items-center">
                    <img
                        src="/logo.png"
                        alt="Logo del Instituto"
                        className="object-contain w-[85%] h-[150px]"
                    />
                </div>

                {/* Formulario */}
                <div className="w-2/3 space-y-8 px-6">
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
                                               focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div className="mt-3">
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
                            <div className="text-red-600 text-sm text-center mt-2">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`group relative w-full flex justify-center py-2 px-4 border 
                                            border-transparent text-sm font-medium rounded-md text-white 
                                            ${loading
                                            ? "bg-gray-400 cursor-not-allowed"
                                            : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
