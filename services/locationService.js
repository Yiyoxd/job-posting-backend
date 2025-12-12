/**
 * ============================================================================
 *  locationService.js — LÓGICA DE NEGOCIO DE UBICACIONES (CACHE + RANKER PRO)
 * ============================================================================
 *
 * Este archivo NO usa Express ni req/res.
 * Solo expone funciones puras/asíncronas que trabajan con:
 *   - Cache de ubicaciones (utils/locationCache.js)
 *   - Índice en memoria para búsquedas rápidas
 *   - Ranker avanzado para /search (similar a jobs pero adaptado a ubicaciones)
 *
 * Funciones de servicio expuestas (usadas por el controller):
 *
 *   ✔ getCountriesService()
 *   ✔ getStatesByCountryService(country)
 *   ✔ getCitiesByStateService(country, state)
 *   ✔ searchLocationsService(q, k)
 *
 * Formatos de respuesta:
 *
 *   - getCountriesService()
 *       → string[]
 *
 *   - getStatesByCountryService(country)
 *       → string[] | null
 *         * string[]  → lista de estados para ese país
 *         * null      → país no encontrado
 *
 *   - getCitiesByStateService(country, state)
 *       → {
 *            status: "ok",
 *            cities: string[]
 *         }
 *         | { status: "country_not_found" }
 *         | { status: "state_not_found" }
 *
 *   - searchLocationsService(q, k)
 *       → {
 *           results: Array<{
 *             type:    "country" | "state" | "city",
 *             country: string,
 *             state?:  string,
 *             city?:   string
 *           }>
 *         }
 *
 * IMPORTANTE PARA EL FRONTEND:
 * -----------------------------
 * - La búsqueda es tolerante a:
 *     * mayúsculas / minúsculas
 *     * acentos (México = Mexico, Coahuila = coáhuila)
 *     * espacios dobles / múltiples
 *     * símbolos raros (se limpian)
 *
 * - Los resultados de /search YA VIENEN ORDENADOS por relevancia
 *   usando un score interno, pero el campo "score" NO se expone.
 *
 * - type indica el nivel:
 *     * "country" → país
 *     * "state"   → estado
 *     * "city"    → ciudad
 *
 *   Esto permite al frontend decidir:
 *     - Mostrar chips diferenciados (país / estado / ciudad)
 *     - Armar breadcrumbs tipo "Mexico > Coahuila > Torreon"
 * ============================================================================
 */

import {
    loadLocationCache,
    getAllLocations,
    getCountry
} from "../utils/locationCache.js";

import { MinHeap } from "../utils/minHeap.js";

/* ============================================================================
 *  NORMALIZADOR / TOKENIZADOR — similar a JobController (entrada ultra limpia)
 * ============================================================================
 *
 * REUSO DE UTILS:
 * - normalize() y tokenize() ya existen en tus utils (utils/text.js)
 * - Aquí NO redefinimos esas funciones para no duplicar lógica.
 */
import { normalize, tokenize } from "../utils/text.js";

/* ============================================================================
 *  ÍNDICE DE BÚSQUEDA EN MEMORIA
 *  - Aplana country / state / city a entradas individuales
 *  - Reutilizable entre llamadas (TOP perf)
 * ============================================================================
 *
 * Estructura del índice (searchIndex):
 *
 *   {
 *     kind: "country" | "state" | "city",
 *     country: string,       // nombre "bonito" tal como viene del JSON
 *     state:   string | null,
 *     city:    string | null,
 *
 *     main:     string,      // nombre principal (country | state | city)
 *     mainNorm: string,      // nombre principal normalizado
 *
 *     countryNorm: string,
 *     stateNorm:   string,
 *     cityNorm:    string,
 *
 *     fullNorm: string,      // "countryNorm stateNorm cityNorm"
 *
 *     tokensMain: string[],  // tokens del nombre principal
 *     tokensAll:  string[]   // tokens de todo el path (país + estado + ciudad)
 *   }
 */

let searchIndex = [];
let searchIndexDocCount = 0;

/**
 * buildSearchIndexFromDocs
 * ------------------------
 * Construye el índice global de búsqueda a partir de los documentos caché.
 *
 * docs: [
 *   {
 *     country: "Mexico",
 *     states: [
 *       { state: "Coahuila", cities: ["Torreon", "Saltillo"] }
 *     ]
 *   },
 *   ...
 * ]
 *
 * Entradas generadas en el índice (ejemplos):
 *
 *   kind: "country"
 *     → { country: "Mexico", state: null, city: null, ... }
 *
 *   kind: "state"
 *     → { country: "Mexico", state: "Coahuila", city: null, ... }
 *
 *   kind: "city"
 *     → { country: "Mexico", state: "Coahuila", city: "Torreon", ... }
 */
function buildSearchIndexFromDocs(docs = []) {
    const index = [];

    for (const doc of docs) {
        const country = doc.country || "";
        const countryNorm = normalize(country);
        const countryTokens = tokenize(country);

        // Entrada de país
        if (countryNorm) {
            index.push({
                kind: "country",
                country,
                state: null,
                city: null,
                main: country,
                mainNorm: countryNorm,
                countryNorm,
                stateNorm: "",
                cityNorm: "",
                fullNorm: countryNorm, // solo país
                tokensMain: countryTokens,
                tokensAll: countryTokens
            });
        }

        // Estados / ciudades
        for (const stateObj of doc.states || []) {
            const state = stateObj.state || "";
            const stateNorm = normalize(state);
            const stateTokens = tokenize(state);

            // Entrada de estado
            if (stateNorm) {
                const fullNormState = `${countryNorm} ${stateNorm}`.trim();
                index.push({
                    kind: "state",
                    country,
                    state,
                    city: null,
                    main: state,
                    mainNorm: stateNorm,
                    countryNorm,
                    stateNorm,
                    cityNorm: "",
                    fullNorm: fullNormState,
                    tokensMain: stateTokens,
                    tokensAll: [...new Set([...countryTokens, ...stateTokens])]
                });
            }

            // Ciudades
            for (const city of stateObj.cities || []) {
                const cityNorm = normalize(city);
                const cityTokens = tokenize(city);

                if (!cityNorm) continue;

                const fullNormCity = `${countryNorm} ${stateNorm} ${cityNorm}`.trim();
                const tokensAll = [
                    ...new Set([...countryTokens, ...stateTokens, ...cityTokens])
                ];

                index.push({
                    kind: "city",
                    country,
                    state,
                    city,
                    main: city,
                    mainNorm: cityNorm,
                    countryNorm,
                    stateNorm,
                    cityNorm,
                    fullNorm: fullNormCity,
                    tokensMain: cityTokens,
                    tokensAll
                });
            }
        }
    }

    searchIndex = index;
    searchIndexDocCount = docs.length;
}

/**
 * ensureSearchIndexReady
 * ----------------------
 * Garantiza que:
 *   - La cache de ubicaciones esté cargada
 *   - El índice aplanado esté construido y actualizado
 */
async function ensureSearchIndexReady() {
    await loadLocationCache();
    const docs = getAllLocations();

    // Si cambió el número de países o aún no hay índice, reconstruimos.
    if (!searchIndex.length || searchIndexDocCount !== docs.length) {
        buildSearchIndexFromDocs(docs);
    }

    return searchIndex;
}

/* ============================================================================
 *  RANKER SUPER INTELIGENTE PARA UBICACIONES
 * ============================================================================
 *
 * Objetivo:
 *   Dado un query (q), ordenar:
 *     - países
 *     - estados
 *     - ciudades
 *   desde lo más relevante a lo menos relevante.
 *
 * Señales usadas (similar al ranking de jobs):
 *   1. Tipo de entidad (country / state / city)
 *      → city > state > country (ciudad es más específica)
 *
 *   2. Coincidencias directas:
 *      - q == nombre (mainNorm)          → match exacto
 *      - q es prefijo de mainNorm        → "lon" → "london"
 *      - q dentro de mainNorm            → "york" → "new york"
 *
 *   3. Coincidencias en el path completo:
 *      - q == fullNorm                   → "mexico coahuila torreon"
 *      - q prefijo de fullNorm           → "mexico coah" → "mexico coahuila torreon"
 *      - q dentro de fullNorm            → "coahuila torre" → "mexico coahuila torreon"
 *
 *   4. Tokens:
 *      - cuántos tokens de q aparecen en el nombre principal
 *      - cuántos tokens de q aparecen en todo el path
 *      - si TODOS los tokens de q aparecen (full coverage)
 *      - si los tokens aparecen en el mismo orden
 *
 *   5. Longitud:
 *      - Penalizamos diferencias muy grandes de longitud entre qNorm y mainNorm
 *        para evitar que "co" matchee igual a "connecticut", "colorado", "coahuila", etc.
 *
 *   6. Boost especial para ciudades:
 *      - Si la query parece describir una ciudad (por tokens/longitud),
 *        se le da un extra a city frente a state/country.
 */

/**
 * computeLocationScore
 * --------------------
 * Calcula un score para una entrada de ubicación.
 *
 * Retorna:
 *   - 0  → si la entrada no es relevante en absoluto
 *   - >0 → score, mientras más alto, más relevante
 */
function computeLocationScore(entry, qNorm, qTokens) {
    if (!qNorm) return 0;

    const {
        kind,
        mainNorm,
        fullNorm,
        tokensMain,
        tokensAll
    } = entry;

    // Si no hay ni 1 token en común y ni siquiera substring, descartamos rápido
    const hasAnyBasicMatch =
        tokensAll.some(t => qNorm.includes(t) || t.includes(qNorm)) ||
        mainNorm.includes(qNorm) ||
        fullNorm.includes(qNorm);

    if (!hasAnyBasicMatch) return 0;

    /* ---------------------------------------------------------------------
     * 1. PESO POR TIPO (PAÍS / ESTADO / CIUDAD)
     * ------------------------------------------------------------------ */
    let typeWeight = 0;
    if (kind === "city") typeWeight = 120;
    else if (kind === "state") typeWeight = 90;
    else if (kind === "country") typeWeight = 70;

    /* ---------------------------------------------------------------------
     * 2. COINCIDENCIAS DIRECTAS EN EL NOMBRE PRINCIPAL
     * ------------------------------------------------------------------ */
    const isExactMain = (qNorm === mainNorm);
    const exactMainScore = isExactMain ? 250 : 0;

    const isPrefixMain = !isExactMain && mainNorm.startsWith(qNorm);
    const prefixMainScore = isPrefixMain ? 180 : 0;

    const isSubstringMain =
        !isExactMain && !isPrefixMain && mainNorm.includes(qNorm);
    const substringMainScore = isSubstringMain ? 120 : 0;

    /* ---------------------------------------------------------------------
     * 3. PATH COMPLETO (PAÍS + ESTADO + CIUDAD)
     * ------------------------------------------------------------------ */
    const isExactFull = (fullNorm === qNorm);
    const exactFullScore = isExactFull ? 200 : 0;

    const isPrefixFull = !isExactFull && fullNorm.startsWith(qNorm);
    const prefixFullScore = isPrefixFull ? 140 : 0;

    const isSubstringFull =
        !isExactFull && !isPrefixFull && fullNorm.includes(qNorm);
    const substringFullScore = isSubstringFull ? 100 : 0;

    /* ---------------------------------------------------------------------
     * 4. TOKENS: COVERAGE Y ORDEN
     * ------------------------------------------------------------------ */
    const uniqueQTokens = [...new Set(qTokens)];
    const totalTokens = uniqueQTokens.length || 1;

    let tokenMatchesMain = 0;
    let tokenMatchesAll = 0;

    for (const t of uniqueQTokens) {
        if (tokensMain.includes(t)) tokenMatchesMain++;
        if (tokensAll.includes(t)) tokenMatchesAll++;
    }

    const ratioMain = tokenMatchesMain / totalTokens;
    const ratioAll = tokenMatchesAll / totalTokens;

    // Coverage completo o parcial
    const fullCoverageMainScore = ratioMain === 1 ? 150 : 0;
    const fullCoverageAllScore = ratioAll === 1 ? 100 : 0;

    const partialCoverageMainScore =
        ratioMain > 0 && ratioMain < 1 ? Math.round(ratioMain * 90) : 0;

    const partialCoverageAllScore =
        ratioAll > 0 && ratioAll < 1 ? Math.round(ratioAll * 60) : 0;

    // Per-token, para diferenciar cuando hay muchos tokens coincidiendo
    const perTokenScore =
        tokenMatchesMain * 35 + // tokens que aparecen en el nombre principal
        tokenMatchesAll * 15;   // tokens que aparecen en cualquier parte del path

    // Orden: si los tokens aparecen en el mismo orden dentro de tokensMain
    let inOrderMainScore = 0;
    if (tokensMain.length && uniqueQTokens.length >= 2) {
        // intentamos encontrar la secuencia de qTokens en tokensMain
        let i = 0;
        let j = 0;
        while (i < tokensMain.length && j < uniqueQTokens.length) {
            // NOTA: aquí se conserva EXACTAMENTE la comparación original
            if (tokensMain[i] === uniqueQTokens[j]) {
                j++;
            }
            i++;
        }
        const inOrderRatio = j / uniqueQTokens.length;
        if (inOrderRatio === 1) inOrderMainScore = 60;
        else if (inOrderRatio >= 0.5) inOrderMainScore = 30;
    }

    /* ---------------------------------------------------------------------
     * 5. LONGITUD: penalización por diferencias muy grandes
     * ------------------------------------------------------------------ */
    const lenDiff = Math.abs(qNorm.length - mainNorm.length);
    const lengthProximityScore = Math.max(0, 40 - Math.min(lenDiff, 40));

    /* ---------------------------------------------------------------------
     * 6. BOOST ESPECIAL PARA CIUDADES
     * ------------------------------------------------------------------ */
    let cityBoostScore = 0;
    if (kind === "city") {
        if (isExactMain || fullCoverageMainScore > 0) {
            cityBoostScore = 80;
        } else if (ratioMain >= 0.6) {
            cityBoostScore = 50;
        } else if (prefixMainScore > 0 || substringMainScore > 0) {
            cityBoostScore = 30;
        }
    }

    /* ---------------------------------------------------------------------
     * 7. SUMA FINAL (score compuesto, similar a finalScore de jobs)
     * ------------------------------------------------------------------ */
    const finalScore =
        typeWeight +
        exactMainScore +
        prefixMainScore +
        substringMainScore +
        exactFullScore +
        prefixFullScore +
        substringFullScore +
        fullCoverageMainScore +
        fullCoverageAllScore +
        partialCoverageMainScore +
        partialCoverageAllScore +
        perTokenScore +
        inOrderMainScore +
        lengthProximityScore +
        cityBoostScore;

    // Si después de todo esto el score es muy bajo, descartamos.
    if (finalScore <= 0) return 0;

    return finalScore;
}

/**
 * collectTopKLocations
 * --------------------
 * Usa MinHeap para obtener el TOP-K mejor rankeado.
 *
 * Entrada:
 *   - query: string (texto buscado)
 *   - k    : número máximo de resultados
 *
 * Salida:
 *   [
 *     {
 *       score:   number,                // solo interno
 *       type:    "country" | "state" | "city",
 *       country: string,
 *       state?:  string,
 *       city?:   string
 *     },
 *     ...
 *   ] ordenado de mayor a menor score.
 */
async function collectTopKLocations(query, k) {
    const index = await ensureSearchIndexReady();

    const qNorm = normalize(query);
    const qTokens = tokenize(query);
    const heap = new MinHeap(k);

    if (!qNorm) return [];

    for (const entry of index) {
        const score = computeLocationScore(entry, qNorm, qTokens);
        if (score <= 0) continue;

        heap.push({
            score,
            type: entry.kind,
            country: entry.country,
            state: entry.state || undefined,
            city: entry.city || undefined
        });
    }

    // Devuelve ordenado de mayor a menor score
    return heap.getSorted();
}

/* ============================================================================
 *  SERVICIOS PÚBLICOS (USADOS POR EL CONTROLLER)
 * ============================================================================
 */

/**
 * getCountriesService
 * -------------------
 * Lógica para:
 *   GET /api/locations/countries
 *
 * @returns {Promise<string[]>} Lista de nombres de países ordenados A-Z.
 *
 * Contrato para el frontend:
 *   - Devuelve un array de strings:
 *       ["Afghanistan", "Albania", "Algeria", ..., "Mexico", ...]
 */
export async function getCountriesService() {
    await loadLocationCache();
    const docs = getAllLocations();

    const countries = docs
        .map(d => d.country)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return countries;
}

/**
 * getStatesByCountryService
 * -------------------------
 * Lógica para:
 *   GET /api/locations/:country/states
 *
 * @param {string} country - Nombre del país tal como viene en la URL.
 * @returns {Promise<string[] | null>}
 *   - string[] → lista de estados ordenados
 *   - null     → si el país no existe
 *
 * Contrato para el frontend:
 *   - Si devuelve array:
 *       ["Coahuila", "Nuevo Leon", "Yucatan", ...]
 *   - Si devuelve null:
 *       El controller responde 404 con { error: "País no encontrado" }
 */
export async function getStatesByCountryService(country) {
    await loadLocationCache();

    const doc = getCountry(country);
    if (!doc) {
        return null; // el controller decide el 404 y el mensaje
    }

    const states = (doc.states || [])
        .map(s => s.state)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return states;
}

/**
 * getCitiesByStateService
 * -----------------------
 * Lógica para:
 *   GET /api/locations/:country/:state/cities
 *
 * @param {string} country - Nombre del país (path param).
 * @param {string} state   - Nombre del estado (path param).
 *
 * @returns {Promise<
 *   { status: "ok", cities: string[] } |
 *   { status: "country_not_found" }   |
 *   { status: "state_not_found" }
 * >}
 *
 * Contrato para el frontend:
 *   - status === "ok"
 *       → cities: ["Torreon", "Saltillo", ...]
 *   - status === "country_not_found"
 *       → el controller responde 404 con { error: "País no encontrado" }
 *   - status === "state_not_found"
 *       → el controller responde 404 con { error: "Estado no encontrado" }
 */
export async function getCitiesByStateService(country, state) {
    await loadLocationCache();

    const doc = getCountry(country);
    if (!doc) {
        return { status: "country_not_found" };
    }

    const stateObj = (doc.states || []).find(s => s.state === state);
    if (!stateObj) {
        return { status: "state_not_found" };
    }

    const cities = (stateObj.cities || [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return { status: "ok", cities };
}

/**
 * searchLocationsService
 * ----------------------
 * Lógica para:
 *   GET /api/locations/search?q=texto&k=20
 *
 * Parámetros:
 *   - q: string
 *       Texto de búsqueda (puede ser país, estado o ciudad, parcial o completo).
 *       EJEMPLOS:
 *         - "mexico"
 *         - "mexico coahuila"
 *         - "torreon"
 *         - "lond"
 *         - "new yo"
 *
 *   - k: number (opcional, default = 20)
 *       Número máximo de resultados a devolver.
 *
 * Contrato de salida (lo que verá el frontend):
 *
 *   {
 *     "results": [
 *       {
 *         "type": "city" | "state" | "country",
 *         "country": string,
 *         "state"?:  string,
 *         "city"?:   string
 *       },
 *       ...
 *     ]
 *   }
 *
 * Ejemplo:
 *   GET /api/locations/search?q=torreon&k=10
 *
 *   → {
 *       "results": [
 *         { "type": "city",   "country": "Mexico", "state": "Coahuila", "city": "Torreon" },
 *         { "type": "state",  "country": "Mexico", "state": "Coahuila" },
 *         { "type": "country","country": "Mexico" },
 *         ...
 *       ]
 *     }
 */
export async function searchLocationsService(qRaw, kRaw) {
    const DEFAULT_K = 20;

    const q = qRaw || "";
    const k = parseInt(String(kRaw || DEFAULT_K), 10) || DEFAULT_K;

    // Si el query está vacío (solo espacios), regresamos lista vacía
    if (!q.trim()) {
        return { results: [] };
    }

    // TOP-K eficiente usando MinHeap + ranker súper avanzado
    const ranked = await collectTopKLocations(q, k);

    // Quitamos score antes de enviar al frontend
    const cleaned = ranked.map(({ score, ...rest }) => rest);

    return { results: cleaned };
}
