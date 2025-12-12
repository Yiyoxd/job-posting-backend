// utils/mongoFilterUtils.js

/**
 * Utilidades para construir filtros MongoDB de forma consistente.
 * Este módulo no depende de Express ni de Mongoose.
 */

import { parseDate, parseNumber } from "./parsingUtils.js";

/**
 * Aplica un mínimo numérico: campo >= valor.
 * @param {Object} filter
 * @param {string} fieldName
 * @param {any} rawValue
 */
export function applyNumericMinFilter(filter, fieldName, rawValue) {
    const min = parseNumber(rawValue);
    if (min === null) return;

    filter[fieldName] = {
        ...(filter[fieldName] || {}),
        $gte: min
    };
}

/**
 * Aplica un máximo numérico: campo <= valor.
 * @param {Object} filter
 * @param {string} fieldName
 * @param {any} rawValue
 */
export function applyNumericMaxFilter(filter, fieldName, rawValue) {
    const max = parseNumber(rawValue);
    if (max === null) return;

    filter[fieldName] = {
        ...(filter[fieldName] || {}),
        $lte: max
    };
}

/**
 * Aplica un rango de fechas (from/to) sobre un campo Date.
 * @param {Object} filter
 * @param {string} fieldName
 * @param {string} fromRaw
 * @param {string} toRaw
 */
export function addDateRangeFilter(filter, fieldName, fromRaw, toRaw) {
    const fromDate = parseDate(fromRaw);
    const toDate = parseDate(toRaw);

    if (!fromDate && !toDate) return;

    filter[fieldName] = {};
    if (fromDate) filter[fieldName].$gte = fromDate;
    if (toDate) filter[fieldName].$lte = toDate;
}
