// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useRef } from "react";
import { toast } from "sonner";
import { api, attachToken } from "../lib/api";
import { ROLE_POLICIES, PERM_ALIASES } from "../auth/permissions";

export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

// ---- helpers ----
const toServerPermSet = (u) => {
  const raw = u?.permissions || u?.perms || u?.scopes || [];
  return new Set(Array.isArray(raw) ? raw : []);
};

const expandPermsFromRoles = (roles = []) => {
  const set = new Set();
  (roles || []).forEach((r) => {
    const bucket = ROLE_POLICIES[r] || [];
    bucket.forEach((p) => set.add(p));
  });
  Object.entries(PERM_ALIASES || {}).forEach(([alias, real]) => {
    if (set.has(real)) set.add(alias);
  });
  return set;
};

// ⚠️ NUEVO: normaliza roles a string[]
const normalizeRoles = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) {
    return roles.map((r) =>
      typeof r === "string" ? r : (r?.name || r?.code || r?.id || "").toString()
    ).filter(Boolean);
  }
  // si viniera un objeto único
  if (typeof roles === "object") return [roles.name || roles.code].filter(Boolean);
  return [];
};

// ⚠️ CAMBIO: unir permisos del backend + derivados de roles
const enrichUser = (u) => {
  if (!u) return u;
  const roles = normalizeRoles(u.roles);
  const full =
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.username ||
    "";
  const serverPerms = toServerPermSet(u);
  const rolePerms = expandPermsFromRoles(roles);
  const finalPerms = new Set([...serverPerms, ...rolePerms]); // ← unión

  return {
    ...u,
    roles,                                   // ← normalizado
    full_name: full,
    permissions: Array.from(finalPerms),     // ← ya incluye alias y rol
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(localStorage.getItem("access") || null);
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh") || null);
  const [loading, setLoading] = useState(true);
  const [permSet, setPermSet] = useState(new Set());
  const refreshingRef = useRef(null);
  const interceptorIdRef = useRef(null);

  useEffect(() => { attachToken(access, refresh); }, [access, refresh]);

  useEffect(() => {
    if (interceptorIdRef.current != null) {
      api.interceptors.response.eject(interceptorIdRef.current);
      interceptorIdRef.current = null;
    }
    if (!access || !refresh) return;

    const id = api.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err?.config;
        if (err?.response?.status !== 401 || original?._retry) return Promise.reject(err);
        original._retry = true;
        try {
          if (!refreshingRef.current) {
            refreshingRef.current = (async () => {
              const { data } = await api.post("/auth/token/refresh/", { refresh });
              const newAccess = data?.access;
              if (!newAccess) throw new Error("Refresh sin access token");
              localStorage.setItem("access", newAccess);
              setAccess(newAccess);
              attachToken(newAccess, refresh);
              return newAccess;
            })().finally(() => { refreshingRef.current = null; });
          }
          const newAccess = await refreshingRef.current;
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
          return api.request(original);
        } catch (e) {
          logout();
          return Promise.reject(e);
        }
      }
    );
    interceptorIdRef.current = id;
    return () => api.interceptors.response.eject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, refresh]);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!access) { setLoading(false); return; }
      try {
        let profile = null;
        try {
          const { data } = await api.get("/auth/me");
          profile = data ?? null;
        } catch {
          const u = localStorage.getItem("last_username");
          if (u) {
            const { data } = await api.get(`/users/search?q=${encodeURIComponent(u)}`);
            profile = (Array.isArray(data) ? data.find((it) => it.username === u) : null)
              ?? { username: u, roles: [] };
          }
        }
        if (!mounted) return;
        setUser(enrichUser(profile));
      } catch {
        setUser(null); setAccess(null); setRefresh(null);
        localStorage.removeItem("access"); localStorage.removeItem("refresh"); localStorage.removeItem("last_username");
      } finally { if (mounted) setLoading(false); }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [access]);

  useEffect(() => { setPermSet(new Set(user?.permissions || [])); }, [user]);

  const login = async (username, password) => {
    const u = String(username || "").trim();
    const p = String(password || "").trim();
    if (!u || !p) { const msg = "Ingresa usuario y contraseña"; toast.error(msg); throw new Error(msg); }
    try {
      const { data } = await api.post("/auth/token/", { username: u, password: p });
      const acc = data?.access, ref = data?.refresh;
      if (!acc || !ref) throw new Error("El backend no devolvió tokens JWT.");
      localStorage.setItem("access", acc);
      localStorage.setItem("refresh", ref);
      localStorage.setItem("last_username", u);
      setAccess(acc); setRefresh(ref); attachToken(acc, ref);

      let profile = null;
      try { const { data: me } = await api.get("/auth/me"); profile = me ?? null; }
      catch {
        const { data: list } = await api.get(`/users/search?q=${encodeURIComponent(u)}`);
        profile = (Array.isArray(list) ? list.find((it) => it.username === u) : null)
          ?? { username: u, roles: [] };
      }
      setUser(enrichUser(profile));
      toast.success("¡Inicio de sesión exitoso!");
      return true;
    } catch (err) {
      toast.error(err?.response?.status === 401 ? "Credenciales inválidas" : "Error al iniciar sesión");
      throw err;
    }
  };

  const logout = () => {
    setUser(null); setPermSet(new Set()); setAccess(null); setRefresh(null);
    localStorage.removeItem("access"); localStorage.removeItem("refresh"); localStorage.removeItem("last_username");
    attachToken(null, null);
    toast.success("Sesión cerrada correctamente");
  };

  const hasPerm = (p) => permSet.has(p);
  const hasAny = (arr = []) => arr.some((p) => permSet.has(p));
  const hasAll = (arr = []) => arr.every((p) => permSet.has(p));

  return (
    <AuthContext.Provider
      value={{
        user,
        roles: user?.roles || [],          // ⚠️ NUEVO: roles normalizados expuestos
        access, refresh,
        loading, login, logout, api,
        hasPerm, hasAny, hasAll,
        permissions: Array.from(permSet),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
