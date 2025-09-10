// src/lib/api.js
import axios from "axios";
import { API_BASE } from "../utils/config";

export const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});

export function attachToken(token) {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
}

// Request-ID por petición
api.interceptors.request.use((config) => {
    const rid = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    config.headers["X-Request-Id"] = rid;
    return config;
});

api.interceptors.response.use(
    (r) => r,
    (err) => Promise.reject(err)
);

// 👇 agrega esta línea
export default api;
