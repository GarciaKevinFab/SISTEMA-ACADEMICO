// src/lib/api.js
import axios from "axios";
import { API_BASE } from "../utils/config";

// ============ Axios base ============
export const api = axios.create({
    baseURL: API_BASE, // ej: http://127.0.0.1:8000/api
});

// ============================
// Tokens en memoria + helpers
// ============================
let accessToken = null;
let refreshToken = null;
let isRefreshing = false;
let pendingRequests = [];

// ============================
// Detectar endpoints públicos
// ============================
const isPublicUrl = (url = "") => {
    const u = String(url || "");

    // OJO: esto matchea tanto si config.url viene como "/admission/public/apply"
    // como si viene full URL por alguna razón.
    return (
        u.includes("/admission/public/") ||
        u.includes("/admission-calls/public") ||
        u.includes("/portal/public/") ||
        u.includes("/public/")
    );
};

// -- API pública para setear/limpiar tokens --
export function attachToken(access, refresh) {
    accessToken = access || null;
    refreshToken = refresh || null;

    try {
        if (access) localStorage.setItem("access", access);
        else localStorage.removeItem("access");

        if (refresh) localStorage.setItem("refresh", refresh);
        else localStorage.removeItem("refresh");
    } catch (_) { }
}

export function clearTokens() {
    accessToken = null;
    refreshToken = null;
    try {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
    } catch (_) { }
}

// Cargar desde localStorage si existían
try {
    const a = localStorage.getItem("access");
    const r = localStorage.getItem("refresh");
    if (a || r) {
        accessToken = a || null;
        refreshToken = r || null;
    }
} catch (_) { }

// ✅ Helper: obtén access SIEMPRE (memoria o localStorage)
function getAccessTokenSafe() {
    if (accessToken) return accessToken;
    try {
        const a = localStorage.getItem("access");
        if (a) {
            accessToken = a;
            return a;
        }
    } catch (_) { }
    return null;
}

function getRefreshTokenSafe() {
    if (refreshToken) return refreshToken;
    try {
        const r = localStorage.getItem("refresh");
        if (r) {
            refreshToken = r;
            return r;
        }
    } catch (_) { }
    return null;
}

// ----- Request: Authorization -----
// ✅ FIX: NO mandar Authorization si es endpoint público
api.interceptors.request.use((config) => {
    const url = config?.url || "";

    // Público = sin auth
    if (isPublicUrl(url)) {
        config.headers = config.headers || {};
        delete config.headers.Authorization;
        return config;
    }

    const token = getAccessTokenSafe();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ----- Refresh helper -----
// ✅ FIX: construir URL correctamente (sin duplicar /api)
function buildRefreshUrl() {
    const base = String(API_BASE || "").replace(/\/+$/, ""); // sin slash final
    return `${base}/auth/token/refresh/`;
}

async function doRefresh() {
    const rToken = getRefreshTokenSafe();
    if (!rToken) return null;

    const url = buildRefreshUrl();
    const { data } = await axios.post(url, { refresh: rToken });
    return data?.access || null;
}

// ----- Response: 401 -> cola de refresh -----
// ✅ FIX: NO refrescar / reintentar si el endpoint es público
api.interceptors.response.use(
    (r) => r,
    async (error) => {
        const status = error?.response?.status;
        const original = error?.config;

        if (!status || !original) return Promise.reject(error);

        // ✅ Público: NO refresh ni retry
        if (isPublicUrl(original.url || "")) {
            return Promise.reject(error);
        }

        // No intentes refrescar si el 401 viene del propio endpoint de refresh
        if (String(original.url || "").includes("/auth/token/refresh/")) {
            return Promise.reject(error);
        }

        // Solo si es 401 y tenemos refresh
        const rToken = getRefreshTokenSafe();
        if (status !== 401 || !rToken) return Promise.reject(error);
        if (original._retry) return Promise.reject(error);
        original._retry = true;

        // Si ya se está refrescando, encola
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                pendingRequests.push({ resolve, reject });
            }).then((newAccess) => {
                original.headers = {
                    ...(original.headers || {}),
                    Authorization: `Bearer ${newAccess}`,
                };
                return api(original);
            });
        }

        // Refrescar
        isRefreshing = true;
        try {
            const newAccess = await doRefresh();
            if (!newAccess) throw new Error("Refresh sin access token");

            accessToken = newAccess;
            try {
                localStorage.setItem("access", newAccess);
            } catch (_) { }

            pendingRequests.forEach((p) => p.resolve(newAccess));
            pendingRequests = [];
            isRefreshing = false;

            original.headers = {
                ...(original.headers || {}),
                Authorization: `Bearer ${newAccess}`,
            };
            return api(original);
        } catch (e) {
            pendingRequests.forEach((p) => p.reject(e));
            pendingRequests = [];
            isRefreshing = false;

            // Si quieres forzar re-login cuando refresh falla:
            // clearTokens();

            return Promise.reject(e);
        }
    }
);

// (Opcional) Precalentado: si solo tienes refresh, obtén access al arrancar
export async function ensureFreshToken() {
    const a = getAccessTokenSafe();
    const r = getRefreshTokenSafe();
    if (a) return a;
    if (!a && r) {
        try {
            const newAccess = await doRefresh();
            if (newAccess) {
                accessToken = newAccess;
                try {
                    localStorage.setItem("access", newAccess);
                } catch (_) { }
                return newAccess;
            }
        } catch (_) { }
    }
    return null;
}

export default api;
