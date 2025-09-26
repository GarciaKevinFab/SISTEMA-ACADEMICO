import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Solo verifica autenticación. Usa `user` (no `token`).
 */
export function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null; // o tu spinner global
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

/**
 * Verifica permisos/roles sin “desloguear”.
 * - `any`: pasa si tiene alguno de estos permisos
 * - `all`: pasa si tiene todos estos permisos
 * - `anyRole`: pasa si tiene alguno de estos roles (fallback)
 */
export function RequirePerm({ any = [], all = [], anyRole = [], children }) {
    const { loading, hasAny, hasAll, roles = [] } = useAuth();
    if (loading) return null;

    const okAny = any.length ? hasAny(any) : true;
    const okAll = all.length ? hasAll(all) : true;
    const okRole = anyRole.length ? anyRole.some((r) => roles.includes(r)) : true;

    if (!(okAny && okAll && okRole)) {
        // No tiene permiso: 403 (NO login, NO logout)
        return <Navigate to="/403" replace />;
    }
    return children;
}
