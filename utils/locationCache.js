// ============================================================================
//  locationCache.js — CACHE DE UBICACIONES EN MEMORIA
// ============================================================================
//  Este módulo mantiene un cache global de las ubicaciones.
//  Se carga automáticamente solo una vez cuando el controlador lo solicita.
// ============================================================================

import Location from "../models/Location.js";

let CACHE = [];
let CACHE_READY = false;

/**
 * Carga el cache solo la primera vez.
 * Es un lazy loader: no carga nada hasta que el controlador lo necesita.
 */
export async function loadLocationCache() {
    if (CACHE_READY) return;

    console.log("🔄 Cargando ubicación en cache...");
    CACHE = await Location.find({}).lean();
    CACHE_READY = true;

    console.log(`✅ Cache listo: ${CACHE.length} países cargados.`);
}

/**
 * Devuelve todo el cache
 */
export function getAllLocations() {
    return CACHE;
}

/**
 * Devuelve el documento de un país
 */
export function getCountry(country) {
    return CACHE.find(doc => doc.country === country);
}
