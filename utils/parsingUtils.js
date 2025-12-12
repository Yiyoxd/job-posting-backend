// utils/parsingUtils.js

/**
 * Utilidades de parseo y normalización para entradas tipo query string.
 * Este módulo no depende de Express ni de Mongoose.
 */

/**
 * Convierte un valor a número. Regresa null si el valor no existe o no es válido.
 * @param {any} value
 * @returns {number|null}
 */
export function parseNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * Convierte un valor a Date (ISO o YYYY-MM-DD). Regresa null si no es válido.
 * @param {string} value
 * @returns {Date|null}
 */
export function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza un término de búsqueda:
 * - trim
 * - colapsa espacios múltiples
 * - minúsculas
 * Regresa null si queda vacío.
 * @param {string} q
 * @returns {string|null}
 */
export function normalizeSearchTerm(q) {
    if (q === undefined || q === null) return null;
    const s = String(q).trim().replace(/\s+/g, " ").toLowerCase();
    return s.length ? s : null;
}

/**
 * Escapa caracteres especiales para construir expresiones regulares seguras.
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
