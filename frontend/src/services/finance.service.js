// src/services/finance.service.js
import { BACKEND_URL } from "../utils/config";

const API = `${BACKEND_URL}/api/finance`;

// =============================
// Helper de headers + token JWT
// =============================
function headers(extra = {}) {
    // Usamos el mismo nombre que usa AuthContext / api.js
    const t = localStorage.getItem("access");
    const h = { "Content-Type": "application/json", ...extra };
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
}

// =============================
// Helper HTTP genérico (fetch)
// =============================
async function http(method, path, body, { qs, hdrs } = {}) {
    const url = new URL(`${API}${path}`);

    if (qs && typeof qs === "object") {
        for (const [k, v] of Object.entries(qs)) {
            if (v !== undefined && v !== null && v !== "") {
                url.searchParams.append(k, v);
            }
        }
    }

    const res = await fetch(url.toString(), {
        method,
        headers: headers(hdrs),
        body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        // respuesta vacía / no JSON
    }

    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

/* ----------------- Caja y Bancos ----------------- */
// Usado por CashBanksDashboard.jsx
export const CashBanks = {
    // Lista de sesiones de caja
    sessions: () => http("GET", "/cashbanks/sessions"),

    // Abrir nueva sesión
    openSession: (payload) => http("POST", "/cashbanks/sessions", payload),

    // Movimientos de una sesión
    movements: (sessionId) => http("GET", `/cashbanks/${sessionId}/movements`),

    // Agregar movimiento a una sesión
    addMovement: (sessionId, payload) =>
        http("POST", `/cashbanks/${sessionId}/movements`, payload),

    // Cerrar sesión
    closeSession: (sessionId, payload) =>
        http("POST", `/cashbanks/${sessionId}/close`, payload),
};

/* ----------------- Catálogo de Conceptos ----------------- */
export const Concepts = {
    list: () => http("GET", "/concepts"),
    create: (payload) => http("POST", "/concepts", payload),
    update: (id, payload) => http("PATCH", `/concepts/${id}`, payload),
    remove: (id) => http("DELETE", `/concepts/${id}`),
};

/* ----------------- Estados de cuenta ----------------- */
// subject_type: "STUDENT" | "APPLICANT"
export const Accounts = {
    statement: ({ subject_id, subject_type }) =>
        http("GET", "/accounts/statement", null, {
            qs: { subject_id, subject_type },
        }),
    // {subject_id, subject_type, concept_id, amount, due_date, meta}
    charge: (payload) => http("POST", "/accounts/charge", payload),
    // {subject_id, subject_type, amount, method, ref, date}
    pay: (payload) => http("POST", "/accounts/pay", payload),
};

/* ----------------- Conciliación bancaria ----------------- */
export const Reconciliation = {
    bankAccounts: () => http("GET", "/bank-accounts"),
    movements: ({ account_id, date_from, date_to }) =>
        http("GET", "/reconciliation/movements", null, {
            qs: { account_id, date_from, date_to },
        }),
    // {account_id, date_from, date_to, statement_balance, items:[{movement_id, reconciled}]}
    save: (payload) => http("POST", "/reconciliation/save", payload),
};

/* ----------------- Reportes ----------------- */
export const FReports = {
    income: ({ date_from, date_to, concept_id, career_id }) =>
        http("GET", "/reports/income", null, {
            qs: { date_from, date_to, concept_id, career_id },
        }),
};

/* ----------------- PSP / Facturación electrónica (stubs) ----------------- */
export const Payments = {
    // Devuelve {url} para redirigir/abrir en nueva pestaña
    createCheckout: ({ subject_id, subject_type, amount, currency = "PEN", meta }) =>
        http("POST", "/payments/checkout", {
            subject_id,
            subject_type,
            amount,
            currency,
            meta,
        }),
};

export const EInvoice = {
    // Emitir documento electrónico para un recibo/boleta
    issue: ({ receipt_id }) => http("POST", "/einvoice/issue", { receipt_id }),
};
