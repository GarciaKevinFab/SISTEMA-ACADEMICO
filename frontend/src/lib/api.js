// src/lib/api.js
import axios from "axios";
import { API_BASE } from "../utils/config";

export const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});

// set/unset token
export function attachToken(token) {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
}

// (Opcional) log básico de errores
api.interceptors.response.use(
    (r) => r,
    (err) => {
        // Puedes centralizar manejo de 401 aquí si quieres redirigir
        return Promise.reject(err);
    }
);
