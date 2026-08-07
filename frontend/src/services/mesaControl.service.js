// src/services/mesaControl.service.js
//
// Mesa de Control Académico — lo que Secretaría necesita corregir y antes solo
// se podía hacer por consola: matrículas confirmadas, alumnos que no aparecen
// en un acta o en una nómina, y fichas duplicadas.
//
// Backend: academic/views/mesa_control.py
import api from "../lib/api";

const BASE = "/academic/mesa-control";

const err = (e) => {
    const d = e?.response?.data;
    const msg = d?.detail || d?.message || e?.message || "Error en la solicitud";
    const out = new Error(msg);
    out.status = e?.response?.status;
    out.data = d;
    return out;
};

const get = async (url, params) => {
    try {
        const { data } = await api.get(url, { params });
        return data;
    } catch (e) { throw err(e); }
};

const post = async (url, body) => {
    try {
        const { data } = await api.post(url, body || {});
        return data;
    } catch (e) { throw err(e); }
};

export const MesaControl = {
    /** Períodos que TIENEN datos, con cuántas matrículas y secciones. Trae
     *  `sugerido`: adivinar el período por la fecha abre uno vacío. */
    periodos: () => get(`${BASE}/periodos`),

    /* ── Panel de incidencias ── */
    incidencias: (period) => get(`${BASE}/incidencias`, { period }),

    /** accion: asignar_secciones | sincronizar_fichas | restaurar_vacias
     *  Sin `aplicar` solo simula y devuelve qué haría. */
    corregir: (accion, period, aplicar = false) =>
        post(`${BASE}/incidencias/corregir`, { accion, period, aplicar }),

    /* ── Alumno ── */
    buscar: (q) => get(`${BASE}/alumnos`, { q }),
    alumno: (dni) => get(`${BASE}/alumno/${encodeURIComponent(dni)}`),

    agregarCurso: (dni, sectionId, period) =>
        post(`${BASE}/alumno/${encodeURIComponent(dni)}/curso`,
            { section_id: sectionId, period }),

    /** Devuelve {requiere_forzar:true, avisos:[...]} con status 409 si el curso
     *  ya tiene notas o asistencia: hay que reintentar con forzar=true. */
    quitarCurso: async (dni, itemId, forzar = false) => {
        try {
            const { data } = await api.delete(
                `${BASE}/alumno/${encodeURIComponent(dni)}/curso/${itemId}`,
                { params: forzar ? { forzar: 1 } : {} });
            return data;
        } catch (e) { throw err(e); }
    },

    asignarSeccion: (dni, itemId, sectionId) =>
        post(`${BASE}/alumno/${encodeURIComponent(dni)}/curso/${itemId}/seccion`,
            { section_id: sectionId }),

    /* ── Sección y fusión ── */
    seccion: (sectionId) => get(`${BASE}/seccion/${sectionId}`),

    fusionar: (dniOrigen, dniDestino, aplicar = false) =>
        post(`${BASE}/fusionar`,
            { dni_origen: dniOrigen, dni_destino: dniDestino, aplicar }),
};

export default MesaControl;
