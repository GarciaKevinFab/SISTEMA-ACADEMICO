// /utils/ui.js
export const ALLOWED_VARIANTS = new Set(['default', 'secondary', 'destructive', 'outline']);
export const clampVariant = (v) => (ALLOWED_VARIANTS.has(String(v)) ? String(v) : 'secondary');

export const safeText = (v, fallback = '-') => {
    if (v == null) return fallback;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
    if (t === 'object') return v.name ?? v.title ?? v.label ?? v.description ?? fallback;
    return fallback;
};

// Evita SelectItem con value === ""
export const optVal = (v) => {
    const s = v == null ? '' : String(v);
    return s.trim() === '' ? null : s;
};
