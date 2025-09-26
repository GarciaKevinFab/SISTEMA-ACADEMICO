// src/utils/pdfQrPolling.js
import { BACKEND_URL, API_BASE } from "./config"; // <- usa lo que ya expone config
const API_URL = API_BASE;                         // <- alias que usa este módulo

const IS_TEST_MODE =
  process.env.REACT_APP_TEST_MODE === "true" ||
  window.location.search.includes("test=true");

const getToken = () =>
  localStorage.getItem("access") ||
  localStorage.getItem("token") ||
  "";

function requireApiBase() {
  if (!API_URL) {
    throw new Error("API_BASE no configurado (BACKEND_URL / REACT_APP_BACKEND_URL)");
  }
}

function apiJoin(path) {
  requireApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  const clean = p.startsWith("/api/") ? p.slice(4) : p;
  return `${API_URL}${clean}`.replace(/([^:]\/)\/+/g, "$1");
}

function absolutize(urlOrPath) {
  if (!urlOrPath) return urlOrPath;
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  if (!BACKEND_URL) throw new Error("BACKEND_URL no configurado");
  const p = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${BACKEND_URL}${p}`.replace(/([^:]\/)\/+/g, "$1");
}
export async function pollTaskStatus(statusUrl, maxAttempts = 30, interval = 1000) {
  const url = absolutize(statusUrl);
  const headers = { Authorization: `Bearer ${getToken()}` };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Polling failed: ${response.status}`);
      const result = await response.json();

      if (result.status === "DONE") {
        return { success: true, data: result, downloadUrl: result.downloadUrl, attempts: attempt + 1 };
      }
      if (result.status === "ERROR") {
        return { success: false, error: result.error || "Task failed", attempts: attempt + 1 };
      }

      await new Promise(r => setTimeout(r, interval));
    } catch (err) {
      console.error(`Polling attempt ${attempt + 1} failed:`, err);
      if (attempt === maxAttempts - 1) throw err;
      await new Promise(r => setTimeout(r, interval));
    }
  }
  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}

export async function generatePDFWithPolling(endpoint, payload = {}, { testId } = {}) {
  requireApiBase();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
  if (IS_TEST_MODE) headers["X-Test-Mode"] = "true";

  // endpoint debe ser relativo a /api, ej: "/procedures/:id/cover"
  const url = apiJoin(endpoint);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: Object.keys(payload || {}).length ? JSON.stringify(payload) : null,
  });

  // Respuesta directa: PDF en el body
  const ct = response.headers.get("content-type") || "";
  if (response.ok && (ct.includes("application/pdf") || ct.includes("application/octet-stream"))) {
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    if (testId) setTestStatus(testId, "done");
    return { success: true, downloadUrl, blob, attempts: 1 };
  }

  if (response.status === 202) {
    const taskInfo = await response.json();
    if (testId) setTestStatus(testId, "processing");
    const result = await pollTaskStatus(taskInfo.statusUrl, 30, 1000);
    if (testId) setTestStatus(testId, result.success ? "done" : "error");
    return result;
  }

  if (response.ok) {
    // JSON con downloadUrl directo
    const data = await response.json().catch(() => ({}));
    if (data.downloadUrl) {
      if (testId) setTestStatus(testId, "done");
      return { success: true, downloadUrl: absolutize(data.downloadUrl) };
    }
  }

  if (testId) setTestStatus(testId, "error");
  throw new Error(`PDF generation failed: ${response.status}`);
}

function setTestStatus(testId, status) {
  const el = document.querySelector(`[data-testid="${testId}-status"]`);
  if (el) {
    el.textContent = status.toUpperCase();
    el.setAttribute("data-status", status);
  }
}

// Descarga con auth (por si la URL es protegida)
export async function downloadFile(url, filename = "download") {
  const abs = absolutize(url);
  const res = await fetch(abs, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

export async function generateQRWithPolling(endpoint, payload = {}, { testId } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
  if (IS_TEST_MODE) headers["X-Test-Mode"] = "true";

  // endpoint relativo a /api, p.ej. "/actas/qr"
  const url = apiJoin(endpoint);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: Object.keys(payload || {}).length ? JSON.stringify(payload) : null,
  });

  if (response.status === 202) {
    const taskInfo = await response.json();
    if (testId) {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      el?.setAttribute("data-status", "processing");
    }
    const result = await pollTaskStatus(taskInfo.statusUrl, 30, 1000);
    if (testId) {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      el?.setAttribute("data-status", result.success ? "done" : "error");
      // si el backend retorna base64
      if (result.success && result.data?.qrCodeData && el) {
        el.src = `data:image/png;base64,${result.data.qrCodeData}`;
      }
    }
    return result;
  }

  if (response.ok) {
    // Respuesta directa JSON con el QR (ej. base64)
    const data = await response.json();
    if (testId && data.qrCodeData) {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (el) {
        el.src = `data:image/png;base64,${data.qrCodeData}`;
        el.setAttribute("data-status", "done");
      }
    }
    return { success: true, data, attempts: 1 };
  }

  if (testId) {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    el?.setAttribute("data-status", "error");
  }
  throw new Error(`QR generation failed: ${response.status}`);
}
