/**
 * ============================================================================
 *  locationRoutes.js — RUTAS DEL MÓDULO DE UBICACIONES
 * ============================================================================
 *
 * Este módulo define los endpoints disponibles para consultar información de
 * ubicaciones a nivel país → estado → ciudad, así como un buscador global.
 *
 * Endpoints disponibles:
 *
 *   GET /api/locations/countries
 *      → Regresa lista de países únicos.
 *
 *   GET /api/locations/:country/states
 *      → Regresa solo los nombres de los estados de un país.
 *
 *   GET /api/locations/:country/:state/cities
 *      → Regresa solo los nombres de las ciudades de un estado.
 *
 *   GET /api/locations/search?q=texto&k=20
 *      → Buscador global con ranking por relevancia (tipo PageRank).
 *
 * Todas las rutas se apoyan en el controlador locationService.js.
 * ============================================================================
 */

import express from "express";

import {
    getCountries,
    getStatesByCountry,
    getCitiesByState,
    searchLocations,
} from "../controllers/locationController.js";

const router = express.Router();

/**
 * GET /countries
 * Devuelve únicamente los nombres de los países ordenados alfabéticamente.
 */
router.get("/countries", getCountries);

/**
 * GET /:country/states
 * Devuelve la lista de estados pertenecientes al país indicado.
 * Param: country (string)
 */
router.get("/:country/states", getStatesByCountry);

/**
 * GET /:country/:state/cities
 * Devuelve la lista de ciudades pertenecientes al estado indicado.
 * Params: country (string), state (string)
 */
router.get("/:country/:state/cities", getCitiesByState);

/**
 * GET /search?q=texto&k=20
 * Realiza búsqueda global de países, estados y ciudades.
 */
router.get("/search", searchLocations);

export default router;
