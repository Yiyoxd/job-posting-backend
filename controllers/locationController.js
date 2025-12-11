/**
 * ============================================================================
 *  locationController.js — CONTROLADOR DE UBICACIONES (ULTRA RÁPIDO)
 * ============================================================================
 *
 * Este archivo contiene:
 *
 *   ✔ Acceso con CACHE EN MEMORIA
 *   ✔ Búsqueda global con MinHeap (TOP-K eficiente)
 *   ✔ Normalización para búsquedas flexibles
 *   ✔ Documentación completa para cada endpoint
 *
 * ============================================================================
 */

import {
    loadLocationCache,
    getAllLocations,
    getCountry
} from "../utils/locationCache.js";

import { MinHeap } from "../utils/minHeap.js";

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

    if (t === query) return 100;
    if (t.startsWith(query)) return 80;
    if (t.includes(query)) return 50;

    return 20 - Math.min(Math.abs(t.length - query.length), 10);
}

/* ============================================================================ */
/* collectMatchesHeap — Búsqueda con MinHeap (TOP-K más rápido) */
/* ============================================================================ */
function collectMatchesHeap(docs, query, k) {
    const qNorm = normalize(query);
    const heap = new MinHeap(k);

    for (const doc of docs) {
        const countryNorm = normalize(doc.country);

        if (countryNorm.includes(qNorm)) {
            heap.push({
                type: "country",
                country: doc.country,
                score: computeScore(doc.country, qNorm)
            });
        }

        for (const stateObj of doc.states) {
            const stateNorm = normalize(stateObj.state);

            if (stateNorm.includes(qNorm)) {
                heap.push({
                    type: "state",
                    country: doc.country,
                    state: stateObj.state,
                    score: computeScore(stateObj.state, qNorm)
                });
            }

            for (const city of stateObj.cities) {
                const cityNorm = normalize(city);

                if (cityNorm.includes(qNorm)) {
                    heap.push({
                        type: "city",
                        country: doc.country,
                        state: stateObj.state,
                        city,
                        score: computeScore(city, qNorm)
                    });
                }
            }
        }
    }

    return heap.getSorted();
}

/* =============================================================================
 *  GET /api/locations/countries — Lista de países
 * =============================================================================
 */
export async function getCountries(req, res) {
    await loadLocationCache();

    const docs = getAllLocations();
    const countries = docs.map(d => d.country).sort();

    return res.json(countries);
}

/* =============================================================================
 *  GET /api/locations/:country/states — Lista de estados
 * =============================================================================
 */
export async function getStatesByCountry(req, res) {
    const { country } = req.params;

    await loadLocationCache();

    const doc = getCountry(country);

    if (!doc) return res.status(404).json({ error: "País no encontrado" });

    return res.json(doc.states.map(s => s.state).sort());
}

/* =============================================================================
 *  GET /api/locations/:country/:state/cities — Lista de ciudades
 * =============================================================================
 */
export async function getCitiesByState(req, res) {
    const { country, state } = req.params;

    await loadLocationCache();

    const doc = getCountry(country);
    if (!doc) return res.status(404).json({ error: "País no encontrado" });

    const stateObj = doc.states.find(s => s.state === state);
    if (!stateObj) return res.status(404).json({ error: "Estado no encontrado" });

    return res.json(stateObj.cities.sort());
}

/* =============================================================================
 *  GET /api/locations/search?q=texto&k=20 — Buscador global ultra rápido
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

        // TOP-K eficiente usando MinHeap
        const results = collectMatchesHeap(docs, q, k);

        // Limpia score antes de enviar
        const cleaned = results.map(({ score, ...rest }) => rest);

        return res.json({ results: cleaned });

    } catch (err) {
        return res.status(500).json({
            error: "Error en búsqueda global",
            details: err.message
        });
    }
}
