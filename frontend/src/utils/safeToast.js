// src/utils/safeToast.js
import React from "react";
import { toast as realToast } from "sonner";

function normalizeMsg(msg, fallback = "Error") {
    if (msg == null) return fallback;
    if (React.isValidElement(msg)) return msg;
    if (typeof msg === "string" || typeof msg === "number") return String(msg);

    const title = msg.title ?? fallback;
    const description =
        msg.description ?? (typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    return { title, description };
}

function callToast(kind, msg, opts) {
    const norm = normalizeMsg(msg, kind === "success" ? "OK" : "Error");
    if (typeof norm === "object" && !React.isValidElement(norm)) {
        return realToast[kind](norm.title, { description: norm.description, ...opts });
    }
    return realToast[kind](norm, opts);
}

export const toast = {
    ...realToast,
    error: (m, o) => callToast("error", m, o),
    success: (m, o) => callToast("success", m, o),
    info: (m, o) => callToast("info", m, o),
    warning: (m, o) => callToast("warning", m, o),
};
