// services/favoriteService.js

/**
 * ============================================================================
 * favoriteService.js — Servicio de Favoritos
 * ============================================================================
 *
 * actor:
 * - { type:"candidate", candidate_id:number, user_id:number }
 *
 * Reglas:
 * - Solo candidatos pueden crear/leer/eliminar favoritos.
 * - Un favorito es único por (candidate_id, job_id).
 *
 * Performance:
 * - El listado usa:
 *   1) leer favoritos paginados (ordenados por created_at desc)
 *   2) resolver jobs con $in y reconstruir el orden original
 * ============================================================================
 */

import Favorite from "../models/Favorite.js";
import Job from "../models/Job.js";

import { parseNumber } from "../utils/parsingUtils.js";
import { buildPaginationParams } from "../utils/paginationUtils.js";

/* =============================================================================
 * Helpers: errores tipados
 * ============================================================================= */
function makeError(code, httpStatus, message) {
    const err = new Error(message);
    err.code = code;
    err.httpStatus = httpStatus;
    return err;
}

/* =============================================================================
 * Helpers: validación actor
 * ============================================================================= */
function requireCandidateActor(actor) {
    if (!actor || !actor.type) {
        throw makeError("unauthorized", 401, "Se requiere autenticación.");
    }
    if (actor.type !== "candidate") {
        throw makeError("forbidden", 403, "Solo candidatos pueden usar favoritos.");
    }
    if (!actor.candidate_id) {
        throw makeError("forbidden", 403, "El actor no tiene candidate_id válido.");
    }
}

function requirePositiveId(name, raw) {
    const n = parseNumber(raw);
    if (!n || n <= 0) {
        throw makeError("invalid_params", 400, `${name} debe ser un número > 0.`);
    }
    return n;
}

/* =============================================================================
 * addFavoriteService
 * =============================================================================
 */

/**
 * addFavoriteService
 * ------------------
 * Agrega un job a favoritos. Operación idempotente:
 * - Si el favorito ya existe, regresa status:"already_favorite".
 *
 * Validaciones:
 * - actor debe ser candidate con candidate_id.
 * - job_id debe ser numérico > 0.
 * - Job debe existir.
 *
 * Retorna:
 * - { status:"added" }
 * - { status:"already_favorite" }
 */
export async function addFavoriteService(actor, job_id) {
    requireCandidateActor(actor);

    const jid = requirePositiveId("job_id", job_id);

    const existsJob = await Job.exists({ job_id: jid });
    if (!existsJob) {
        throw makeError("not_found", 404, "El empleo no existe.");
    }

    try {
        await Favorite.create({
            candidate_id: actor.candidate_id,
            job_id: jid
        });
    } catch (err) {
        // Duplicado por índice único
        if (err?.code === 11000) {
            return { status: "already_favorite" };
        }
        throw err;
    }

    return { status: "added" };
}

/* =============================================================================
 * removeFavoriteService
 * =============================================================================
 */

/**
 * removeFavoriteService
 * ---------------------
 * Elimina un favorito. Operación idempotente:
 * - Si no existía, responde igualmente removed.
 *
 * Validaciones:
 * - actor candidate
 * - job_id válido
 *
 * Retorna:
 * - { status:"removed" }
 */
export async function removeFavoriteService(actor, job_id) {
    requireCandidateActor(actor);

    const jid = requirePositiveId("job_id", job_id);

    await Favorite.deleteOne({
        candidate_id: actor.candidate_id,
        job_id: jid
    });

    return { status: "removed" };
}

/* =============================================================================
 * listFavoritesService
 * =============================================================================
 */

/**
 * listFavoritesService
 * --------------------
 * Lista favoritos del candidato con los Jobs completos.
 *
 * Query:
 * - page (default 1)
 * - limit (default 20)
 *
 * Retorna:
 * - {
 *     status:"ok",
 *     total, page, limit,
 *     items: [{ favorited_at, job }]
 *   }
 *
 * Notas:
 * - Si un Job ya no existe (import limpio / datos cambiaron), job puede ser null.
 */
export async function listFavoritesService(actor, queryParams = {}) {
    requireCandidateActor(actor);

    const { page, limit, skip } = buildPaginationParams(queryParams);

    const [total, favorites] = await Promise.all([
        Favorite.countDocuments({ candidate_id: actor.candidate_id }),
        Favorite.find({ candidate_id: actor.candidate_id })
            .sort({ created_at: -1, favorite_id: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
    ]);

    const jobIds = favorites.map((f) => f.job_id);

    const jobs = jobIds.length
        ? await Job.find({ job_id: { $in: jobIds } }).lean()
        : [];

    const jobMap = new Map(jobs.map((j) => [j.job_id, j]));

    const items = favorites.map((f) => ({
        favorited_at: f.created_at,
        job: jobMap.get(f.job_id) || null
    }));

    return {
        status: "ok",
        total,
        page,
        limit,
        items
    };
}
