// src/pages/Login.jsx — UI/UX mejorado
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

/* ─── inject font ─── */
function InjectLoginFont() {
  useEffect(() => {
    const id = "login-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.id = id + "-css";
    s.textContent = `
          .login-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .login-root * { font-family: inherit; }
          @keyframes card-in  { from{opacity:0;transform:translateY(20px) scale(.98)} to{opacity:1;transform:none} }
          @keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
          .card-in { animation: card-in .45s cubic-bezier(.22,1,.36,1) both; }
          .shake   { animation: shake .4s ease both; }
        `;
    document.head.appendChild(s);
  }, []);
  return null;
}

const Login = () => {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 420);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(formData.username, formData.password);
      if (res?.mfa_required) return;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <InjectLoginFont />
      <div className="login-root min-h-screen flex items-center justify-center py-10 px-4 sm:px-6 relative bg-cover bg-center"
        style={{ backgroundImage: "url('/bg-login.png')" }}>

        {/* overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 via-blue-950/55 to-indigo-950/65 backdrop-blur-[3px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_55%)]" />

        {/* back button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-sm font-600 text-white/70 hover:text-white bg-white/8 hover:bg-white/14 border border-white/12 px-3.5 py-2 rounded-xl transition-all duration-200"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        {/* card */}
        <div className={`card-in relative z-10 w-full max-w-[860px] ${shaking ? "shake" : ""}`}>
          <div className="bg-white/[0.88] backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.28)] border border-white/50 overflow-hidden">

            {/* top accent line */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" />

            <div className="flex flex-col md:flex-row">

              {/* ── LEFT PANEL ── */}
              <div className="w-full md:w-[40%] flex flex-col items-center justify-center gap-5 px-8 py-10 bg-gradient-to-b from-blue-950 to-indigo-900 relative overflow-hidden">
                {/* decorative blobs */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />

                <img src="/logo.png" alt="Logo del Instituto" className="relative z-10 w-32 md:w-36 object-contain drop-shadow-xl" draggable="false" />
                <img src="/loguito.png" alt="Logotipo secundario" className="relative z-10 w-28 md:w-32 object-contain opacity-90" draggable="false" />

                <div className="relative z-10 text-center space-y-1.5 mt-1">
                  <p className="text-white font-800 text-base leading-snug">IESPP</p>
                  <p className="text-blue-200/80 text-xs font-500 leading-snug max-w-[180px] mx-auto">"Gustavo Allende Llavería"</p>
                  <p className="text-indigo-300/70 text-[10px] uppercase tracking-[0.15em] font-600 mt-2">Tarma — Junín, Perú</p>
                </div>

                {/* bottom decorative dots */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {[1, 2, 3].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
                </div>
              </div>

              {/* ── RIGHT PANEL ── */}
              <div className="w-full md:w-[60%] px-8 sm:px-12 py-10 flex flex-col justify-center">
                <div className="max-w-sm mx-auto w-full">

                  {/* heading */}
                  <div className="mb-8">
                    <p className="text-[11px] font-700 text-indigo-500 uppercase tracking-[0.18em] mb-1.5">Bienvenido</p>
                    <h2 className="text-2xl sm:text-3xl font-900 text-slate-900 tracking-tight leading-tight">Sistema Académico</h2>
                    <p className="text-sm text-slate-500 mt-1.5 font-400">Ingresa tus credenciales para continuar</p>
                  </div>

                  {/* form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* username */}
                    <div className="space-y-1.5">
                      <label htmlFor="username" className="text-xs font-700 text-slate-600 uppercase tracking-wider">Usuario</label>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        placeholder="Tu nombre de usuario"
                        value={formData.username}
                        onChange={handleChange}
                        className={`w-full h-11 px-4 rounded-xl border text-sm font-500 text-slate-800 bg-white placeholder:text-slate-300 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 ${error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 hover:border-slate-300"}`}
                      />
                    </div>

                    {/* password */}
                    <div className="space-y-1.5">
                      <label htmlFor="password" className="text-xs font-700 text-slate-600 uppercase tracking-wider">Contraseña</label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPwd ? "text" : "password"}
                          autoComplete="current-password"
                          required
                          placeholder="Tu contraseña"
                          value={formData.password}
                          onChange={handleChange}
                          className={`w-full h-11 px-4 pr-11 rounded-xl border text-sm font-500 text-slate-800 bg-white placeholder:text-slate-300 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 ${error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 hover:border-slate-300"}`}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          onClick={() => setShowPwd((p) => !p)}
                          aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* error */}
                    {error && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs font-600 px-3.5 py-2.5 rounded-xl">
                        <AlertCircle size={13} className="shrink-0" />
                        {error}
                      </div>
                    )}

                    {/* submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full h-11 rounded-xl text-sm font-800 tracking-wide transition-all duration-200 flex items-center justify-center gap-2 mt-2 ${loading
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-[#1E2F49] to-indigo-800 text-white hover:from-[#162338] hover:to-indigo-700 shadow-lg shadow-blue-950/25 hover:shadow-xl hover:shadow-blue-950/30 hover:scale-[1.01] active:scale-[0.99]"
                        }`}
                    >
                      {loading ? <><Loader2 size={15} className="animate-spin" /> Iniciando sesión…</> : "Iniciar Sesión"}
                    </button>
                  </form>

                  {/* footer */}
                  <p className="mt-8 text-center text-[11px] text-slate-400 font-400 leading-relaxed">
                    © {new Date().getFullYear()} IESPP Gustavo Allende Llavería<br />
                    <span className="text-slate-300">Sistema Académico Integral</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;