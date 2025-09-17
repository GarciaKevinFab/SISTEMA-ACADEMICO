import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({ children }) {
    const { token, loading } = useAuth();
    if (loading) return null;                // o tu spinner global
    if (!token) return <Navigate to="/login" replace />;
    return children;
}

export function RequirePerm({ any = [], all = [], children }) {
    const { loading, hasAny, hasAll } = useAuth();
    if (loading) return null;
    const okAny = any.length ? hasAny(any) : true;
    const okAll = all.length ? hasAll(all) : true;
    if (!okAny || !okAll) return <Navigate to="/403" replace />;
    return children;
}
