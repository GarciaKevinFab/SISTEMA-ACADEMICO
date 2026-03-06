import { API_BASE } from "./config";

// API_BASE: http://127.0.0.1:8000/api
export function toAbsoluteMediaUrl(u) {
    if (!u) return "";
    const s = String(u).trim();
    if (!s) return "";

    // ya es absoluta
    if (s.startsWith("http://") || s.startsWith("https://")) return s;

    // s es /media/...
    const base = String(API_BASE || "").replace(/\/+$/, ""); // sin slash final
    const origin = base.replace(/\/api$/, "");               // quita /api al final
    return `${origin}${s.startsWith("/") ? "" : "/"}${s}`;
}
