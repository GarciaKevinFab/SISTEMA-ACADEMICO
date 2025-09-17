import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function IfPerm({ any = [], all = [], not = [], children, fallback = null }) {
    const { hasAny, hasAll } = useAuth();

    const okAny = any.length ? hasAny(any) : true;
    const okAll = all.length ? hasAll(all) : true;
    const okNot = not.length ? !hasAny(not) : true;

    return okAny && okAll && okNot ? <>{children}</> : fallback;
}