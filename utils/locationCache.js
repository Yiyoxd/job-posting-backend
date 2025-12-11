// ============================================================================
//  locationCache.js — Cache en memoria para evitar hits repetidos a MongoDB
//  Se carga una sola vez y se reutiliza en todos los endpoints.
// ============================================================================

import Location from "../models/Location.js";

let CACHE = null;

export async function loadLocationCache() {
    if (CACHE) return; // Ya cargado

    const docs = await Location.find({}).lean();
    CACHE = docs;
}

export function getAllLocations() {
    return CACHE || [];
}

export function getCountry(countryName) {
    return (CACHE || []).find(c => c.country === countryName) || null;
}
