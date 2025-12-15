// controllers/favoriteController.js

/**
 * ============================================================================
 * favoriteController.js — Controlador HTTP de Favoritos
 * ============================================================================
 *
 * Contrato:
 * - Requiere req.actor con:
 *   { type:"candidate", candidate_id:number, user_id:number }
 *
 * Respuestas:
 * - OK:    { status:"...", ...payload }
 * - Error: { status:"error", code, message }
 *
 * Status HTTP:
 * - Se deriva de err.httpStatus cuando exista; default 500.
 * ============================================================================
 */

import {
    addFavoriteService,
    removeFavoriteService,
    listFavoritesService
} from "../services/favoriteService.js";

/* =============================================================================
 * Helpers de respuesta
 * ============================================================================= */
function sendOk(res, body) {
    return res.status(200).json(body);
}

function sendCreated(res, body) {
    return res.status(201).json(body);
}

function sendError(res, err) {
    const httpStatus = err?.httpStatus || 500;
    const code = err?.code || "internal_error";
    const message = err?.message || "Error interno.";

    return res.status(httpStatus).json({
        status: "error",
        code,
        message
    });
}

/* =============================================================================
 * POST /api/favorites/:job_id
 * Agrega un empleo a favoritos (idempotente)
 *
 * Respuestas:
 * - 201 { status:"added" }
 * - 200 { status:"already_favorite" }  (si ya existía)
 * - 404 { status:"error", code:"not_found", ... } (si job no existe)
 * ============================================================================= */
export async function addFavoriteController(req, res) {
    try {
        const out = await addFavoriteService(req.actor, req.params.job_id);

        if (out.status === "already_favorite") {
            return sendOk(res, out);
        }

        return sendCreated(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * DELETE /api/favorites/:job_id
 * Quita un empleo de favoritos (idempotente)
 *
 * Respuestas:
 * - 200 { status:"removed" }  (aunque no existiera)
 * ============================================================================= */
export async function removeFavoriteController(req, res) {
    try {
        const out = await removeFavoriteService(req.actor, req.params.job_id);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/favorites
 * Lista favoritos del candidato con Jobs completos (paginado)
 *
 * Query:
 * - page?  (default 1)
 * - limit? (default 20)
 *
 * Respuesta:
 * - 200 {
 *     status:"ok",
 *     total, page, limit,
 *     items: [
 *       { favorited_at: Date, job: {...job} }
 *     ]
 *   }
 * ============================================================================= */
export async function listFavoritesController(req, res) {
    try {
        const out = await listFavoritesService(req.actor, req.query);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}
