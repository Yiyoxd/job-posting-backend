/**
 * ============================================================================
 *  locationController.js — CONTROLADOR DE UBICACIONES (ULTRA RÁPIDO + RANKER PRO)
 * ============================================================================
 *
 * Endpoints (NO CAMBIAN):
 *
 *   GET  /api/locations/countries
 *        → Lista de países.
 *
 *   GET  /api/locations/:country/states
 *        → Lista de estados de un país.
 *
 *   GET  /api/locations/:country/:state/cities
 *        → Lista de ciudades de un estado.
 *
 *   GET  /api/locations/search?q=texto&k=20
 *        → Buscador global (país / estado / ciudad) con ranking avanzado.
 *
 * Este archivo:
 *   - NO contiene lógica de ranking, cache ni MinHeap.
 *   - SOLO:
 *       * Lee req.params / req.query
 *       * Llama a locationService
 *       * Maneja códigos de estado y estructura final de la respuesta HTTP
 *
 * Toda la lógica pesada vive en:
 *   - services/locationService.js
 * ============================================================================
 */

import {
    getCountriesService,
    getStatesByCountryService,
    getCitiesByStateService,
    searchLocationsService
} from "../services/locationService.js";

/* =============================================================================
 *  GET /api/locations/countries — Lista de países
 * =============================================================================
 */

/**
 * GET /api/locations/countries
 * ----------------------------
 * Devuelve la lista de países disponibles en el sistema.
 *
 * NO recibe parámetros.
 *
 * RESPUESTA (200 OK):
 *   [
 *     "Afghanistan",
 *     "Argentina",
 *     "Brazil",
 *     "Mexico",
 *     ...
 *   ]
 *
 * Uso típico en frontend:
 *   - Llenar un combo de países en formularios de filtros o registro.
 */
export async function getCountries(req, res) {
    try {
        const countries = await getCountriesService();
        return res.json(countries);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener países",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/locations/:country/states — Lista de estados de un país
 * =============================================================================
 */

/**
 * GET /api/locations/:country/states
 * ----------------------------------
 * Devuelve la lista de estados pertenecientes a un país.
 *
 * PATH PARAMS:
 *   - country: string
 *       Nombre del país tal como está guardado en la base/JSON
 *       (ej. "Mexico", "United States", etc.).
 *
 * RESPUESTAS:
 *
 *   200 OK:
 *     [
 *       "Coahuila",
 *       "Jalisco",
 *       "Nuevo Leon",
 *       ...
 *     ]
 *
 *   404 Not Found:
 *     { "error": "País no encontrado" }
 *
 * Uso típico en frontend:
 *   - Cuando el usuario selecciona un país en un combo, llamar
 *     a este endpoint para llenar el combo de estados.
 */
export async function getStatesByCountry(req, res) {
    const { country } = req.params;

    try {
        const states = await getStatesByCountryService(country);

        if (!states) {
            return res.status(404).json({ error: "País no encontrado" });
        }

        return res.json(states);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener estados",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/locations/:country/:state/cities — Lista de ciudades
 * =============================================================================
 */

/**
 * GET /api/locations/:country/:state/cities
 * -----------------------------------------
 * Devuelve la lista de ciudades de un estado específico de un país.
 *
 * PATH PARAMS:
 *   - country: string
 *       País (ej. "Mexico").
 *   - state: string
 *       Estado (ej. "Coahuila").
 *
 * RESPUESTAS:
 *
 *   200 OK:
 *     [
 *       "Torreon",
 *       "Saltillo",
 *       ...
 *     ]
 *
 *   404 Not Found:
 *     { "error": "País no encontrado" }
 *     { "error": "Estado no encontrado" }
 *
 * Uso típico en frontend:
 *   - Después de seleccionar país y estado, obtener las ciudades
 *     para completar filtros o formularios.
 */
export async function getCitiesByState(req, res) {
    const { country, state } = req.params;

    try {
        const result = await getCitiesByStateService(country, state);

        if (result.status === "country_not_found") {
            return res.status(404).json({ error: "País no encontrado" });
        }

        if (result.status === "state_not_found") {
            return res.status(404).json({ error: "Estado no encontrado" });
        }

        // status === "ok"
        return res.json(result.cities);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener ciudades",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/locations/search?q=texto&k=20 — Buscador global ultra rápido
 * =============================================================================
 */

/**
 * GET /api/locations/search
 * -------------------------
 * Buscador global de ubicaciones (país / estado / ciudad) con ranking avanzado.
 *
 * QUERY PARAMS:
 *   - q : string (OBLIGATORIO)
 *       Texto de búsqueda. Puede ser:
 *         * Un país completo:       "Mexico"
 *         * Un estado:              "Coahuila"
 *         * Una ciudad:             "Torreon"
 *         * Parte de cualquiera:    "tor", "mex", "coah", etc.
 *
 *   - k : number (opcional, default = 20)
 *       Número máximo de resultados a devolver.
 *
 * RESPUESTA (200 OK):
 *   {
 *     "results": [
 *       {
 *         "type": "city" | "state" | "country",
 *         "country": string,
 *         "state"?: string,
 *         "city"?: string
 *       },
 *       ...
 *     ]
 *   }
 *
 * Notas para el frontend:
 *   - Los resultados ya vienen ordenados por relevancia (primeros = mejores).
 *   - "type" indica el nivel de la coincidencia:
 *        * "city"    → match muy específico (lo más detallado)
 *        * "state"   → match a nivel estado
 *        * "country" → match genérico a país
 *   - No se expone el "score" interno, solo la ubicación.
 *
 * Ejemplos:
 *   GET /api/locations/search?q=torreon
 *     → results con "Torreon" (city), "Coahuila" (state), "Mexico" (country)
 *
 *   GET /api/locations/search?q=mexico&k=5
 *     → results empezando por:
 *         { type: "country", country: "Mexico" }
 *         { type: "city", country: "Mexico", state: "Ciudad de Mexico", city: "Mexico City" }
 *         ...
 */
export async function searchLocations(req, res) {
    try {
        const q = req.query.q || "";
        const k = req.query.k;

        const payload = await searchLocationsService(q, k);
        return res.json(payload);
    } catch (err) {
        return res.status(500).json({
            error: "Error en búsqueda global",
            details: err.message
        });
    }
}
