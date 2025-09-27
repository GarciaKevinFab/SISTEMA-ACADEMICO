// src/utils/safeToast.js
import React from "react";
import { toast as realToast } from "sonner";

function normalizeMsg(msg, fallback = "Aviso") {
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

// función base que también soporta toast({title, description})
function baseToast(msg, opts) {
  const norm = normalizeMsg(msg, "Aviso");
  if (typeof norm === "object" && !React.isValidElement(norm)) {
    return realToast(norm.title, { description: norm.description, ...opts });
  }
  return realToast(norm, opts);
}

// adjuntamos los métodos típicos
baseToast.success = (m, o) => callToast("success", m, o);
baseToast.error   = (m, o) => callToast("error", m, o);
baseToast.info    = (m, o) => callToast("info", m, o);
baseToast.warning = (m, o) => callToast("warning", m, o);

// opcional: reexpone APIs de sonner (dismiss, custom, etc.)
baseToast.dismiss = realToast.dismiss;
baseToast.promise = realToast.promise;

export const toast = baseToast;
