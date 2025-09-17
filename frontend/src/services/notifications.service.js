// src/services/notifications.service.js
// Servicio transversal de notificaciones (templates + envíos + logs)
const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BASE}/api`;

function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    const h = { ...extra };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
}

async function http(method, path, { qs, body, headers, isFormData } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs) {
        Object.entries(qs).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
        });
    }
    const res = await fetch(url.toString(), {
        method,
        headers: isFormData
            ? authHeaders(headers)
            : authHeaders({ "Content-Type": "application/json", ...headers }),
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

// ================= Templates =================
export const Templates = {
    list: (params) => http("GET", "/notifications/templates", { qs: params }),
    get: (id) => http("GET", `/notifications/templates/${id}`),
    create: (payload) => http("POST", "/notifications/templates", { body: payload }),
    update: (id, payload) => http("PATCH", `/notifications/templates/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/notifications/templates/${id}`),
    setActive: (id, is_active) =>
        http("POST", `/notifications/templates/${id}/active`, { body: { is_active } }),
    previewRemote: (payload) =>
        http("POST", "/notifications/templates/preview", { body: payload }),
};

// ================= Events (bindings) =================
export const Events = {
    list: () => http("GET", "/notifications/events"), // devuelve eventos soportados + bindings
    setBinding: (event_key, channel, template_id) =>
        http("POST", "/notifications/events/binding", {
            body: { event_key, channel, template_id },
        }),
};

// ================= Send/Test =================
export const Sender = {
    sendTest: (payload) => http("POST", "/notifications/send-test", { body: payload }),
};

// ================= Logs =================
export const Logs = {
    list: (params) => http("GET", "/notifications/logs", { qs: params }),
    retry: (logId) => http("POST", `/notifications/logs/${logId}/retry`),
};

// -------- Utilidad local: render ingenuo de {{placeholders}} --------
export function naiveCompile(str = "", data = {}) {
    return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const parts = key.split(".");
        let val = data;
        for (const p of parts) val = val?.[p];
        return (val ?? "");
    });
}

// Constantes de canales
export const CHANNELS = [
    { value: "EMAIL", label: "Email" },
    { value: "SMS", label: "SMS" },
    { value: "IN_APP", label: "In-App" },
];

// Definición local de eventos (UI). Backend puede devolver su propia lista.
export const EVENT_DEFS = [
    {
        key: "ADMISSION.PREINSCRIPTION_RECEIVED",
        label: "Admisión · Preinscripción recibida",
        variables: ["first_name", "last_name", "document", "career_name", "created_at"],
    },
    {
        key: "ADMISSION.DOCS_VALIDATED",
        label: "Admisión · Validación de documentos",
        variables: ["first_name", "status", "observations", "ticket"],
    },
    {
        key: "ADMISSION.RESULTS_PUBLISHED",
        label: "Admisión · Resultados publicados",
        variables: ["first_name", "result", "ranking", "score", "url_results"],
    },
    {
        key: "ACADEMIC.ENROLLMENT_CONFIRMED",
        label: "Académico · Matrícula confirmada",
        variables: ["student_name", "program", "period", "payment_status"],
    },
    {
        key: "ACADEMIC.GRADEBOOK_PUBLISHED",
        label: "Académico · Acta publicada",
        variables: ["student_name", "course", "term", "final_grade", "url_acta"],
    },
    {
        key: "MP.DERIVATION",
        label: "Mesa de Partes · Derivación",
        variables: ["applicant_name", "tracking_code", "to_office", "deadline"],
    },
    {
        key: "MP.ATTENDED",
        label: "Mesa de Partes · Atención/Respuesta",
        variables: ["applicant_name", "tracking_code", "status", "url_pdf"],
    },
];

// Presets HTML y SMS cortos
export const PRESETS = {
    "ADMISSION.PREINSCRIPTION_RECEIVED": {
        email_subject: "Tu preinscripción fue recibida - {{career_name}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>¡Hola {{first_name}}!</h2>
      <p>Hemos recibido tu <b>preinscripción</b> para <b>{{career_name}}</b> el {{created_at}}.</p>
      <p>Pronto te contactaremos para indicarte los siguientes pasos.</p>
      <hr/>
      <small>IESPP "Gustavo Allende Llavería"</small>
    </div>`,
        sms_text: "IESPP: Recibimos tu preinscripción a {{career_name}}. Te contactaremos pronto.",
    },
    "ADMISSION.DOCS_VALIDATED": {
        email_subject: "Validación de documentos: {{status}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Validación de documentos</h2>
      <p>Hola {{first_name}}, el estado de tu validación es: <b>{{status}}</b>.</p>
      <p>{{observations}}</p>
      <p>N° Ticket: <b>{{ticket}}</b></p>
    </div>`,
        sms_text: "IESPP: Validación de docs {{status}}. Ticket {{ticket}}.",
    },
    "ADMISSION.RESULTS_PUBLISHED": {
        email_subject: "Resultados de Admisión",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Resultados de Admisión</h2>
      <p>Hola {{first_name}}, tu resultado es <b>{{result}}</b> (puntaje: {{score}}).</p>
      <p>Revisa el detalle en: <a href="{{url_results}}">{{url_results}}</a></p>
    </div>`,
        sms_text: "IESPP: Resultado admisión {{result}} ({{score}}). Detalle: {{url_results}}",
    },
    "ACADEMIC.ENROLLMENT_CONFIRMED": {
        email_subject: "Matrícula confirmada - {{period}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Matrícula confirmada</h2>
      <p>{{student_name}}, tu matrícula en <b>{{program}}</b> para {{period}} fue confirmada.</p>
      <p>Estado de pago: {{payment_status}}</p>
    </div>`,
        sms_text: "IESPP: Matrícula confirmada {{program}} {{period}}.",
    },
    "ACADEMIC.GRADEBOOK_PUBLISHED": {
        email_subject: "Acta publicada: {{course}} - {{term}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Acta publicada</h2>
      <p>{{student_name}}, ya puedes revisar tu nota final ({{final_grade}}) de {{course}}.</p>
      <p>Ver acta: <a href="{{url_acta}}">{{url_acta}}</a></p>
    </div>`,
        sms_text: "IESPP: Acta publicada {{course}}. Nota: {{final_grade}}.",
    },
    "MP.DERIVATION": {
        email_subject: "Derivación de trámite {{tracking_code}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Derivación de trámite</h2>
      <p>Se derivó tu trámite <b>{{tracking_code}}</b> a <b>{{to_office}}</b>.</p>
      <p>Plazo estimado: {{deadline}}</p>
    </div>`,
        sms_text: "IESPP: Tram. {{tracking_code}} derivado a {{to_office}}. Plazo {{deadline}}.",
    },
    "MP.ATTENDED": {
        email_subject: "Atención de trámite {{tracking_code}}",
        email_html: `
    <div style="font-family:Inter,Arial,sans-serif">
      <h2>Atención de trámite</h2>
      <p>Hola {{applicant_name}}, tu trámite {{tracking_code}} está <b>{{status}}</b>.</p>
      <p>Descarga el PDF: <a href="{{url_pdf}}">aquí</a></p>
    </div>`,
        sms_text: "IESPP: Tram. {{tracking_code}} {{status}}. PDF: {{url_pdf}}",
    },
};
