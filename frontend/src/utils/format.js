// /utils/format.js
export const PEN = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
});

export const fmtCurrency = (n) => PEN.format(Number(n ?? 0));

export function formatApiError(err, fallback = 'Ocurrió un error') {
    const d = err?.response?.data;
    if (d?.detail) {
        if (typeof d.detail === 'string') return d.detail;
        if (Array.isArray(d.detail)) {
            const msgs = d.detail
                .map((e) => {
                    const field = Array.isArray(e?.loc) ? e.loc.join('.') : e?.loc;
                    return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
                })
                .filter(Boolean);
            if (msgs.length) return msgs.join(' | ');
        }
    }
    if (typeof d?.error?.message === 'string') return d.error.message;
    if (typeof d?.message === 'string') return d.message;
    if (typeof d?.error === 'string') return d.error;
    if (typeof err?.message === 'string') return err.message;
    return fallback;
}

export const toLimaDateTime = (v) =>
    v ? new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '-';

export const toLimaDate = (v) =>
    v ? new Date(v).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '-';
