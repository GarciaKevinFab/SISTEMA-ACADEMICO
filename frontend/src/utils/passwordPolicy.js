// src/utils/passwordPolicy.js
const COMMON = ["123456", "password", "qwerty", "111111", "abc123", "admin", "123456789", "000000"];

export function validatePassword(pwd = "") {
    const errors = [];
    if (pwd.length < 10) errors.push("Mínimo 10 caracteres");
    if (!/[A-Z]/.test(pwd)) errors.push("Al menos 1 mayúscula");
    if (!/[a-z]/.test(pwd)) errors.push("Al menos 1 minúscula");
    if (!/[0-9]/.test(pwd)) errors.push("Al menos 1 número");
    if (!/[^\w\s]/.test(pwd)) errors.push("Al menos 1 símbolo");
    if (COMMON.includes(pwd.toLowerCase())) errors.push("Contraseña muy común");
    const score = Math.max(0, 5 - errors.length); // 0–5
    return { valid: errors.length === 0, errors, score };
}
