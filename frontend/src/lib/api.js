// src/lib/api.js
import axios from "axios";

// Permite sobreescribir por .env (REACT_APP_API_URL) o usa localhost
const BASE_URL =
    process.env.REACT_APP_API_URL?.replace(/\/+$/, "") || "http://localhost:8000/api";

export const api = axios.create({
    baseURL: BASE_URL,
});

// ============================
// Manejo de tokens en memoria
// ============================
let accessToken = null;
let refreshToken = null;
let isRefreshing = false;
let pendingRequests = [];

/**
 * Adjunta/actualiza los tokens usados por la instancia axios.
 * Guárdalos también en localStorage desde tu AuthContext.
 */
export function attachToken(access, refresh) {
    accessToken = access || null;
    refreshToken = refresh || null;
}

// -----------------------------
// Request: agrega Authorization
// -----------------------------
api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// -----------------------------
// Helper: refrescar access token
// -----------------------------
async function doRefresh() {
    const url = `${BASE_URL}/auth/token/refresh/`;
    const { data } = await axios.post(url, { refresh: refreshToken });
    return data?.access;
}

// -----------------------------
// Response: 401 -> refresh cola
// -----------------------------
api.interceptors.response.use(
    (r) => r,
    async (error) => {
        const original = error?.config;

        // Si no hay respuesta (network error), no intentes refresh
        const status = error?.response?.status;
        if (!status) return Promise.reject(error);

        // Si no es 401, no tocamos nada (403 = permisos insuficientes)
        if (status !== 401 || !refreshToken) {
            return Promise.reject(error);
        }

        // Evitar bucles de reintento
        if (original?._retry) {
            return Promise.reject(error);
        }
        original._retry = true;

        // Si ya hay un refresh en curso, encola y reintenta cuando termine
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

        // Ejecutar refresh
        isRefreshing = true;
        try {
            const newAccess = await doRefresh();
            if (!newAccess) throw new Error("Refresh sin access token");

            // Actualiza memoria y localStorage (útil si la app recarga)
            accessToken = newAccess;
            try {
                localStorage.setItem("access", newAccess);
            } catch (_) { }

            // Resuelve a los que estaban esperando
            pendingRequests.forEach((p) => p.resolve(newAccess));
            pendingRequests = [];
            isRefreshing = false;

            // Reintenta request original con el nuevo token
            original.headers = {
                ...(original.headers || {}),
                Authorization: `Bearer ${newAccess}`,
            };
            return api(original);
        } catch (e) {
            // Falla de refresh: rechaza todas las esperas
            pendingRequests.forEach((p) => p.reject(e));
            pendingRequests = [];
            isRefreshing = false;

            // No hacemos logout aquí; que lo maneje AuthContext al recibir el error.
            return Promise.reject(e);
        }
    }
);

export default api;
