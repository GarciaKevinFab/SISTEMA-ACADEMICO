// src/services/security.service.js
import { api } from "../lib/api";

export const SecurityService = {
    startMFASetup: () => api.post("/auth/mfa/setup").then(r => r.data),   // { otpauth_url, secret }
    verifyMFASetup: (code) => api.post("/auth/mfa/verify", { code }).then(r => r.data),
    disableMFA: () => api.post("/auth/mfa/disable").then(r => r.data),
    getBackupCodes: () => api.post("/auth/mfa/backup-codes").then(r => r.data), // o GET, según backend
    challenge: ({ code, token }) => api.post("/auth/mfa/challenge", { code }, {
        headers: { Authorization: `Bearer ${token}` }  // token temporal
    }).then(r => r.data),
};
