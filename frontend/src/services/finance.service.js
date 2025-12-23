// src/services/finance.service.js
import api from "../lib/api";

// helper
const unwrap = (r) => r.data;

export const FinanceDashboard = {
    stats: () => api.get("/finance/dashboard/stats").then(unwrap),
};

export const CashBanks = {
    sessions: () => api.get("/finance/cashbanks/sessions").then(unwrap),
    openSession: (payload) => api.post("/finance/cashbanks/sessions", payload).then(unwrap),
    movements: (sessionId) => api.get(`/finance/cashbanks/${sessionId}/movements`).then(unwrap),
    addMovement: (sessionId, payload) => api.post(`/finance/cashbanks/${sessionId}/movements`, payload).then(unwrap),
    closeSession: (sessionId, payload) => api.post(`/finance/cashbanks/${sessionId}/close`, payload).then(unwrap),
    exportSessionPdf: (sessionId) => api.post(`/finance/cashbanks/${sessionId}/export`, {}).then(unwrap),
};

export const Concepts = {
    list: () => api.get("/finance/concepts").then(unwrap),
    create: (payload) => api.post("/finance/concepts", payload).then(unwrap),
    update: (id, payload) => api.patch(`/finance/concepts/${id}`, payload).then(unwrap),
    remove: (id) => api.delete(`/finance/concepts/${id}`).then(unwrap),
};

export const Accounts = {
    statement: ({ subject_id, subject_type }) =>
        api.get("/finance/accounts/statement", { params: { subject_id, subject_type } }).then(unwrap),

    charge: (payload) => api.post("/finance/accounts/charge", payload).then(unwrap),
    pay: (payload) => api.post("/finance/accounts/pay", payload).then(unwrap),

    // ✅ PDF real (blob)
    statementPdf: ({ subject_id, subject_type }) =>
        api.get("/finance/accounts/statement/pdf", {
            params: { subject_id, subject_type },
            responseType: "blob",
        }),
};

export const Reconciliation = {
    bankAccounts: () => api.get("/finance/bank-accounts").then(unwrap),
    movements: ({ account_id, date_from, date_to }) =>
        api.get("/finance/reconciliation/movements", { params: { account_id, date_from, date_to } }).then(unwrap),
    save: (payload) => api.post("/finance/reconciliation/save", payload).then(unwrap),
};

export const FReports = {
    income: ({ date_from, date_to, concept_id, career_id }) =>
        api.get("/finance/reports/income", { params: { date_from, date_to, concept_id, career_id } }).then(unwrap),
};

export const Payments = {
    createCheckout: ({ subject_id, subject_type, amount, currency = "PEN", meta }) =>
        api.post("/finance/payments/checkout", { subject_id, subject_type, amount, currency, meta }).then(unwrap),
};

export const EInvoice = {
    issue: ({ receipt_id }) => api.post("/finance/einvoice/issue", { receipt_id }).then(unwrap),
};

export const Receipts = {
    // ✅ SIN slash final (porque tu Django URL es "receipts")
    list: () => api.get("/finance/receipts").then(unwrap),

    // ✅ SIN slash final
    create: (payload) => api.post("/finance/receipts", payload).then(unwrap),

    // ✅ SIN slash final
    pay: (id, payload, headers = {}) =>
        api.post(`/finance/receipts/${id}/pay`, payload, { headers }).then(unwrap),

    // ✅ SIN slash final
    cancel: (id, payload) =>
        api.post(`/finance/receipts/${id}/cancel`, payload).then(unwrap),

    // ✅ PDF blob SIN slash final
    pdf: (id) =>
        api.get(`/finance/receipts/${id}/pdf`, { responseType: "blob" }),
};


// ✅ INVENTARIO dentro de finance.service.js
export const Inventory = {
    // Items
    items: () => api.get("/finance/inventory/items").then(unwrap),
    createItem: (payload) => api.post("/finance/inventory/items", payload).then(unwrap),
    updateItem: (id, payload) => api.patch(`/finance/inventory/items/${id}`, payload).then(unwrap),
    removeItem: (id) => api.delete(`/finance/inventory/items/${id}`).then(unwrap),

    // Movimientos
    movements: ({ limit = 20 } = {}) => api.get("/finance/inventory/movements", { params: { limit } }).then(unwrap),

    createMovement: (payload) => api.post("/finance/inventory/movements", payload).then(unwrap),

    // Alertas
    alerts: () => api.get("/finance/inventory/alerts").then(unwrap),

    // Kardex
    kardex: (itemId) => api.get(`/finance/inventory/items/${itemId}/kardex`).then(unwrap),

    // Kardex PDF (blob) si lo implementas luego
    kardexPdf: (itemId) => api.get(`/finance/inventory/items/${itemId}/kardex/pdf`, { responseType: "blob" }),
};

// ✅ LOGÍSTICA dentro de finance.service.js
export const Logistics = {
    // Proveedores
    suppliers: () => api.get("/finance/logistics/suppliers").then(unwrap),
    createSupplier: (payload) => api.post("/finance/logistics/suppliers", payload).then(unwrap),
    updateSupplier: (id, payload) => api.patch(`/finance/logistics/suppliers/${id}`, payload).then(unwrap),

    // Export CSV (blob)
    suppliersCsv: () => api.get("/finance/logistics/suppliers/export/csv", { responseType: "blob" }),

    // Requerimientos
    requirements: () => api.get("/finance/logistics/requirements").then(unwrap),
    createRequirement: (payload) => api.post("/finance/logistics/requirements", payload).then(unwrap),
    requirement: (id) => api.get(`/finance/logistics/requirements/${id}`).then(unwrap),

    // Estados de requerimiento
    submitRequirement: (id) => api.post(`/finance/logistics/requirements/${id}/submit`, {}).then(unwrap),
    approveRequirement: (id) => api.post(`/finance/logistics/requirements/${id}/approve`, {}).then(unwrap),
    rejectRequirement: (id, payload) => api.post(`/finance/logistics/requirements/${id}/reject`, payload).then(unwrap),

    // PDF requerimiento (blob)
    requirementPdf: (id) => api.get(`/finance/logistics/requirements/${id}/pdf`, { responseType: "blob" }),

    // Órdenes de compra
    purchaseOrders: () => api.get("/finance/logistics/purchase-orders").then(unwrap),
    createPurchaseOrder: (payload) => api.post("/finance/logistics/purchase-orders", payload).then(unwrap),
    purchaseOrder: (id) => api.get(`/finance/logistics/purchase-orders/${id}`).then(unwrap),

    sendPurchaseOrder: (id) => api.post(`/finance/logistics/purchase-orders/${id}/send`, {}).then(unwrap),
    receivePurchaseOrder: (id) => api.post(`/finance/logistics/purchase-orders/${id}/receive`, {}).then(unwrap),
    cancelPurchaseOrder: (id) => api.post(`/finance/logistics/purchase-orders/${id}/cancel`, {}).then(unwrap),

    // PDF OC (blob)
    purchaseOrderPdf: (id) => api.get(`/finance/logistics/purchase-orders/${id}/pdf`, { responseType: "blob" }),

    employees: () => api.get("/finance/hr/employees/").then(unwrap),
    createEmployee: (payload) => api.post("/finance/hr/employees/", payload).then(unwrap),
    updateEmployee: (id, payload) => api.patch(`/finance/hr/employees/${id}/`, payload).then(unwrap),
    removeEmployee: (id) => api.delete(`/finance/hr/employees/${id}/`).then(unwrap),

    attendance: ({ date_from, date_to }) =>
        api.get("/finance/hr/attendance/", { params: { date_from, date_to } }).then(unwrap),

    createAttendance: (payload) => api.post("/finance/hr/attendance/", payload).then(unwrap),

    // ✅ CONTRATOS
    contracts: () => api.get("/finance/hr/contracts/").then(unwrap),
    createContract: (payload) => api.post("/finance/hr/contracts/", payload).then(unwrap),
    updateContract: (id, payload) => api.patch(`/finance/hr/contracts/${id}/`, payload).then(unwrap),
    terminateContract: (id, payload) => api.patch(`/finance/hr/contracts/${id}/`, payload).then(unwrap),

};
