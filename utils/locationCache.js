// ============================================================================
//  locationCache.js — Cache en memoria para evitar hits repetidos a MongoDB
//  Se carga una sola vez y se reutiliza en todos los endpoints.
// ============================================================================

import Location from "../models/Location.js";

let CACHE = null;

function medir() {
    console.log((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), "MB");
}

export async function loadLocationCache() {
    if (CACHE) return; // Ya cargado

    //medir();

    const docs = await Location.find({}).lean();
    CACHE = docs;

    //medir(); El cache pesa 8MB lo q m parece bn
}

export function getAllLocations() {
    return CACHE || [];
}

export function getCountry(countryName) {
    return (CACHE || []).find(c => c.country === countryName) || null;
}
