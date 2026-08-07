// useActivePeriod — período académico VIGENTE según el sistema (no el calendario).
// Lee el período marcado como activo en Académico → Periodos (catálogo).
// Mientras carga (o si no hay ninguno activo) usa una estimación por fecha,
// que se corrige sola apenas responde el servidor.
import { useEffect, useState } from "react";
import { Periods } from "@/services/catalogs.service";

// Sem I: mar–jul, Sem II: ago–dic (getMonth() 0-6 = ene–jul)
const estimarPorFecha = () => {
    const n = new Date();
    return `${n.getFullYear()}-${n.getMonth() < 7 ? "I" : "II"}`;
};

// Cache a nivel de módulo: una sola consulta por sesión de la app
let _cache = null;
let _promise = null;

async function fetchActivePeriod() {
    if (_cache) return _cache;
    if (!_promise) {
        _promise = (async () => {
            try {
                const data = await Periods.list();
                const items = data?.items ?? data ?? [];
                const act = items.find((p) => p.is_active);
                if (act?.code) {
                    _cache = act.code;
                } else {
                    // Sin período activo: usar el que contiene la fecha de hoy
                    const hoy = new Date().toISOString().slice(0, 10);
                    const vigente = items.find(
                        (p) => p.start_date && p.end_date && p.start_date <= hoy && hoy <= p.end_date
                    );
                    if (vigente?.code) _cache = vigente.code;
                }
            } catch { /* mantener estimación */ }
            return _cache;
        })();
    }
    return _promise;
}

export function useActivePeriod() {
    const [period, setPeriod] = useState(_cache || estimarPorFecha());
    const [ready, setReady] = useState(!!_cache);

    useEffect(() => {
        let cancel = false;
        fetchActivePeriod().then((code) => {
            if (!cancel) {
                if (code) setPeriod((prev) => (prev === estimarPorFecha() ? code : prev));
                setReady(true);
            }
        });
        return () => { cancel = true; };
    }, []);

    return { period, setPeriod, ready };
}

/** Invalida el cache (llámalo si cambias el período vigente en Periodos). */
export function invalidateActivePeriod() {
    _cache = null;
    _promise = null;
}
