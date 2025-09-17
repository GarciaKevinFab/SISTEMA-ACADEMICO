import React, { createContext, useState, useEffect, useContext } from "react";
import { toast } from "sonner";
import { api, attachToken } from "../lib/api";

export const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

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

// Normaliza permisos a Set cualquiera sea el nombre del campo que envíe el backend
const toPermSet = (u) => {
  const raw =
    u?.permissions ||
    u?.perms ||
    u?.scopes ||
    [];
  return new Set(Array.isArray(raw) ? raw : []);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const [permSet, setPermSet] = useState(new Set());

  // Mantén el Authorization en la instancia compartida cuando cambie el token
  useEffect(() => {
    attachToken(token);
  }, [token]);

  // Cargar perfil con /auth/me si hay token
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (!mounted) return;
        const profile = data?.user ?? data ?? null;
        setUser(profile);
        setPermSet(toPermSet(profile));
      } catch {
        if (!mounted) return;
        setUser(null);
        setPermSet(new Set());
        localStorage.removeItem("token");
        setToken(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Si cambia el user por cualquier motivo, recalcula permisos
  useEffect(() => {
    setPermSet(toPermSet(user));
  }, [user]);

  // Helpers de permisos
  const hasPerm = (p) => permSet.has(p);
  const hasAny = (arr = []) => arr.some((p) => permSet.has(p));
  const hasAll = (arr = []) => arr.every((p) => permSet.has(p));

  const login = async (username, password) => {
    // Validaciones rápidas
    if (username == null || password == null) {
      const msg = "Falta usuario y/o contraseña";
      toast.error(msg);
      throw new Error(msg);
    }
    const u = String(username).trim();
    const p = String(password).trim();
    if (!u || !p) {
      const msg = "Ingresa usuario y contraseña";
      toast.error(msg);
      throw new Error(msg);
    }

    try {
      // El backend espera exactamente { username, password }
      const { data } = await api.post("/auth/login", { username: u, password: p });

      const access_token = data?.access_token || data?.token || data?.accessToken;
      const profile = data?.user || data?.profile || data?.data?.user || null;

      if (!access_token) throw new Error("El backend no devolvió token.");

      localStorage.setItem("token", access_token);
      setToken(access_token); // dispara attachToken() vía useEffect
      setUser(profile);
      setPermSet(toPermSet(profile));

      toast.success("¡Inicio de sesión exitoso!");
      setTimeout(() => (window.location.href = "/dashboard"), 600);
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 422) {
        toast.error("El backend espera JSON: { username, password }");
      } else if (status === 401) {
        toast.error("Credenciales inválidas");
      } else {
        toast.error(formatApiError(err, "Error al iniciar sesión"));
      }
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await api.post("/auth/register", userData);

      const access_token = data?.access_token || data?.token || data?.accessToken;
      const profile = data?.user || null;

      if (!access_token) throw new Error("Registro OK pero sin token.");

      localStorage.setItem("token", access_token);
      setToken(access_token);
      setUser(profile);
      setPermSet(toPermSet(profile));

      toast.success("¡Registro exitoso!");
      return true;
    } catch (e) {
      toast.error(formatApiError(e, "Error al registrarse"));
      throw e;
    }
  };

  const logout = () => {
    setUser(null);
    setPermSet(new Set());
    setToken(null);
    localStorage.removeItem("token");
    attachToken(null);
    toast.success("Sesión cerrada correctamente");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        loading,
        api,
        // helpers
        hasPerm,
        hasAny,
        hasAll,
        // 👇 expón el listado plano para utilidades como <IfPerm/>
        permissions: Array.from(permSet),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
