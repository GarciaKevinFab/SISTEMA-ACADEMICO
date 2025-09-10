// src/services/audit.service.js
import { api } from "../lib/api";

export const AuditService = {
    list: (params = {}) => api.get("/audit", { params }).then(r => r.data),
    // filtros sugeridos: actor, action, entity, entity_id, from, to, limit, offset
};
