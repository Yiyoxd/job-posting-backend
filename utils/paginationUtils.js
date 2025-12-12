// utils/paginationUtils.js

/**
 * Utilidades de paginación (page, limit, skip) para consultas.
 * Este módulo no depende de Express ni de Mongoose.
 */

/**
 * Construye parámetros de paginación a partir de queryParams.
 * @param {Object} queryParams
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function buildPaginationParams(queryParams = {}) {
    const page = Math.max(parseInt(queryParams.page || "1", 10), 1);
    const limit = Math.max(parseInt(queryParams.limit || "20", 10), 1);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
