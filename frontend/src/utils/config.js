// src/utils/config.js

function readMeta(name) {
    if (typeof document === "undefined") return null;
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") : null;
}

// 1) Runtime (sin rebuild) vía window.__APP_CONFIG__.BACKEND_URL
const fromRuntime =
    typeof window !== "undefined" &&
    window.__APP_CONFIG__ &&
    window.__APP_CONFIG__.BACKEND_URL;

// 2) CRA .env en build time (opcional)
const fromCRA =
    typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_BACKEND_URL;

// 3) <meta name="backend-url" content="..."> en public/index.html (runtime)
const fromMeta = readMeta("backend-url");

const RAW =
    fromRuntime ||
    fromCRA ||
    fromMeta ||
    "https://sis.iesppallende.edu.pe"; // default dev

export const BACKEND_URL = RAW.replace(/\/+$/, "");
export const API_BASE = `${BACKEND_URL}/api`;
