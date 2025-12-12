// utils/assets/logoUtils.js

/**
 * Utilidades para construir rutas públicas de logos.
 * Centraliza la convención de URL usada por el frontend para solicitar imágenes.
 */

export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";
export const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const LOGO_PUBLIC_PREFIX = "/company_logos";
export const LOGO_PROCESSED_DIR = "processed";
export const LOGO_RELATIVE_DIR = `${LOGO_PUBLIC_PREFIX}/${LOGO_PROCESSED_DIR}`;

/**
 * Construye la URL absoluta del logo con base en company_id.
 * @param {number|string|null} companyId
 * @returns {string|null}
 */
export function buildLogoFullPath(companyId) {
    if (companyId === undefined || companyId === null || companyId === "") return null;
    return `${ASSET_BASE_URL}${LOGO_RELATIVE_DIR}/${companyId}.png`;
}
