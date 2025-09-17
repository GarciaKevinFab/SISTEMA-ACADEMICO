// src/services/finance.service.js
const BASE = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BASE}/api/finance`;

function headers(extra = {}) {
    const t = localStorage.getItem("token");
    const h = { "Content-Type": "application/json", ...extra };
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
}

async function http(method, path, body, { qs, hdrs } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs && typeof qs === "object") {
        for (const [k, v] of Object.entries(qs)) {
            if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
        }
    }
    const res = await fetch(url.toString(), {
        method,
        headers: headers(hdrs),
        body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (_) { }

    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

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
        http("GET", "/accounts/statement", null, { qs: { subject_id, subject_type } }),
    charge: (payload) => http("POST", "/accounts/charge", payload), // {subject_id, subject_type, concept_id, amount, due_date, meta}
    pay: (payload) => http("POST", "/accounts/pay", payload),       // {subject_id, subject_type, amount, method, ref, date}
};

/* ----------------- Conciliación bancaria ----------------- */
export const Reconciliation = {
    bankAccounts: () => http("GET", "/bank-accounts"),
    movements: ({ account_id, date_from, date_to }) =>
        http("GET", "/reconciliation/movements", null, { qs: { account_id, date_from, date_to } }),
    save: (payload) => http("POST", "/reconciliation/save", payload), // {account_id, date_from, date_to, statement_balance, items:[{movement_id, reconciled}]}
};

/* ----------------- Reportes ----------------- */
export const FReports = {
    income: ({ date_from, date_to, concept_id, career_id }) =>
        http("GET", "/reports/income", null, { qs: { date_from, date_to, concept_id, career_id } }),
};

/* ----------------- PSP / Facturación electrónica (stubs) ----------------- */
export const Payments = {
    // Devuelve {url} para redirigir/abrir en nueva pestaña
    createCheckout: ({ subject_id, subject_type, amount, currency = "PEN", meta }) =>
        http("POST", "/payments/checkout", { subject_id, subject_type, amount, currency, meta }),
};

export const EInvoice = {
    // Si tu TDR exige e-factura: emitir documento electrónico para un recibo/boleta
    issue: ({ receipt_id }) => http("POST", "/einvoice/issue", { receipt_id }),
};
