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

// ----- Request: Authorization -----
api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// ----- Refresh helper -----
async function doRefresh() {
    // Ajusta la URL del refresh al endpoint de tu backend (DRF SimpleJWT por defecto)
    const url = `${API_BASE}/auth/token/refresh/`;
    const { data } = await axios.post(url, { refresh: refreshToken });
    return data?.access;
}

// ----- Response: 401 -> cola de refresh -----
api.interceptors.response.use(
    (r) => r,
    async (error) => {
        const status = error?.response?.status;
        const original = error?.config;

        if (!status || !original) return Promise.reject(error);
        // No intentes refrescar si el 401 viene del propio endpoint de refresh
        if (original.url?.includes("/auth/token/refresh/")) return Promise.reject(error);
        if (status !== 401 || !refreshToken) return Promise.reject(error);
        if (original._retry) return Promise.reject(error);
        original._retry = true;

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
            // En este punto podrías limpiar tokens si quieres forzar re-login:
            // clearTokens();
            return Promise.reject(e);
        }
    }
);

// (Opcional) Precalentado: si solo tienes refresh, obtén access al arrancar
export async function ensureFreshToken() {
    if (!accessToken && refreshToken) {
        try {
            const newAccess = await doRefresh();
            if (newAccess) {
                accessToken = newAccess;
                try {
                    localStorage.setItem("access", newAccess);
                } catch (_) { }
            }
        } catch (_) {
            // Silencioso; el primer request se encargará de refrescar igualmente.
        }
    }
}

export default api;
