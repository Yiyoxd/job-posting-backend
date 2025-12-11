/**
 * ============================================================================
 *  locationController.js — CONTROLADOR DE UBICACIONES
 * ============================================================================
 *
 * Este archivo contiene toda la lógica para consultar ubicaciones desde el
 * modelo Location organizado como árbol:
 *
 *   Location {
 *       country: "Mexico",
 *       states: [
 *          { state: "Coahuila", cities: ["Torreon", "Saltillo"] }
 *       ]
 *   }
 *
 * Endpoints implementados:
 *
 *   ✔ getCountries()        → Regresa lista de países
 *   ✔ getStatesByCountry()  → Regresa estados de un país
 *   ✔ getCitiesByState()    → Regresa ciudades de un estado
 *   ✔ searchLocations()     → Buscador global con ranking inteligente
 *
 * Ahora incluye CACHE EN MEMORIA para evitar consultas repetidas a Mongo.
 * ============================================================================
 */

import {
    loadLocationCache,
    getAllLocations,
    getCountry
} from "../utils/locationCache.js";

/* =============================================================================
 *               GET /api/locations/countries
 * =============================================================================
 */
export async function getCountries(req, res) {

    await loadLocationCache(); // <── Cache automático

    const docs = getAllLocations();
    const countries = docs.map(d => d.country).sort();

    return res.json(countries);
}

/* =============================================================================
 *               GET /api/locations/:country/states
 * =============================================================================
 */
export async function getStatesByCountry(req, res) {
    const { country } = req.params;

    await loadLocationCache();

    const doc = getCountry(country);

    if (!doc) {
        return res.status(404).json({ error: "País no encontrado" });
    }

    const states = doc.states.map(s => s.state).sort();

    return res.json(states);
}

/* =============================================================================
 *               GET /api/locations/:country/:state/cities
 * =============================================================================
 */
export async function getCitiesByState(req, res) {
    const { country, state } = req.params;

    await loadLocationCache();

    const doc = getCountry(country);

    if (!doc) {
        return res.status(404).json({ error: "País no encontrado" });
    }

    const stateObj = doc.states.find(s => s.state === state);

    if (!stateObj) {
        return res.status(404).json({ error: "Estado no encontrado" });
    }

    return res.json(stateObj.cities.sort());
}

/* ============================================================================ */
/* NORMALIZADOR — convierte texto a formato uniforme */
/* ============================================================================ */
function normalize(str = "") {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // acentos
        .replace(/[^a-z0-9\s]/g, "")     // símbolos
        .trim();
}

/* ============================================================================ */
/* computeScore — Algoritmo de ranking (tipo PageRank mejorado) */
/* ============================================================================ */
function computeScore(text, query) {
    const t = normalize(text);
    const q = normalize(query);

    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 50;

    return 20 - Math.min(Math.abs(t.length - q.length), 10);
}

/* ============================================================================ */
/* collectMatches — Extrae coincidencias en país / estado / ciudad */
/* ============================================================================ */
function collectMatches(docs, query) {
    const qNorm = normalize(query);
    const results = [];

    for (const doc of docs) {
        const countryNorm = normalize(doc.country);

        // País
        if (countryNorm.includes(qNorm)) {
            results.push({
                type: "country",
                country: doc.country,
                score: computeScore(doc.country, query)
            });
        }

        // Estados y ciudades
        for (const stateObj of doc.states) {
            const stateNorm = normalize(stateObj.state);

            if (stateNorm.includes(qNorm)) {
                results.push({
                    type: "state",
                    country: doc.country,
                    state: stateObj.state,
                    score: computeScore(stateObj.state, query)
                });
            }

            for (const city of stateObj.cities) {
                const cityNorm = normalize(city);

                if (cityNorm.includes(qNorm)) {
                    results.push({
                        type: "city",
                        country: doc.country,
                        state: stateObj.state,
                        city,
                        score: computeScore(city, query)
                    });
                }
            }
        }
    }

    return results;
}

/* =============================================================================
 *          GET /api/locations/search?q=texto&k=20 — Buscador global
 * =============================================================================
 */
export async function searchLocations(req, res) {
    const DEFAULT_K = 20;

    try {
        const q = req.query.q || "";
        const k = parseInt(req.query.k || DEFAULT_K);

        if (!q.trim()) return res.json({ results: [] });

        await loadLocationCache();

        const docs = getAllLocations();
        const matches = collectMatches(docs, q);

        // Ordenar por score
        matches.sort((a, b) => b.score - a.score);

        // Limpiar score antes de enviar
        const cleaned = matches.slice(0, k).map(({ score, ...rest }) => rest);

        return res.json({ results: cleaned });

    } catch (err) {
        return res.status(500).json({
            error: "Error en búsqueda global",
            details: err.message
        });
    }
}
