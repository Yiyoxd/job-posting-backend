// controllers/candidateController.js

/**
 * ============================================================================
 * candidateController.js — Controlador HTTP de Candidatos
 * ============================================================================
 *
 * Este controlador define el contrato HTTP para el frontend.
 *
 * Requisito de autenticación:
 * - Debe existir req.actor con la forma:
 *   { type: "candidate" | "company" | "admin", candidate_id?: number, company_id?: number }
 *
 * Respuestas JSON:
 * - Siempre regresan un campo "status" y, cuando aplica, el payload correspondiente.
 *
 * Errores:
 * - Errores de autorización/validación se regresan como:
 *   { status: "error", code: string, message: string }
 * - El status HTTP se deriva de err.httpStatus cuando exista.
 */

import {
    createCandidateService,
    getCandidateByIdService,
    updateCandidateService,
    listCandidatesForCompanyService,
    resolveCandidateCvService
} from "../services/candidateService.js";

/* =============================================================================
 * Helpers de respuesta
 * =============================================================================
 */
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
 * POST /api/candidates
 * Crea perfil de candidato
 *
 * Body:
 * - full_name (string, requerido)
 * - contact: { email, phone?, linkedin_url? } (requerido email)
 * - country?, state?, city?, headline?
 *
 * Respuestas:
 * - 201 { status:"created", candidate: {..., cv_url } }
 * - 200 { status:"already_exists", candidate: {..., cv_url } }
 * ============================================================================
 */
export async function createCandidateController(req, res) {
    try {
        const out = await createCandidateService(req.body);

        if (out.status === "created") return sendCreated(res, out);
        if (out.status === "already_exists") return sendOk(res, out);

        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/candidates/:candidate_id
 * Obtiene perfil de candidato (según permisos del actor)
 *
 * Respuestas:
 * - 200 { status:"ok", candidate: {..., cv_url } }
 * - 200 { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * ============================================================================
 */
export async function getCandidateByIdController(req, res) {
    try {
        const out = await getCandidateByIdService(req.actor, req.params.candidate_id);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * PATCH /api/candidates/:candidate_id
 * Actualiza perfil del candidato (PATCH semántico)
 *
 * Body (solo campos presentes se actualizan):
 * - full_name?
 * - contact?
 * - country?
 * - state?
 * - city?
 * - headline?
 *
 * Respuestas:
 * - 200 { status:"ok", candidate: {..., cv_url } }
 * - 200 { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * ============================================================================
 */
export async function updateCandidateController(req, res) {
    try {
        const out = await updateCandidateService(req.actor, req.params.candidate_id, req.body);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/companies/:company_id/candidates
 * Lista candidatos visibles para una empresa (solo quienes postularon)
 *
 * Query:
 * - page? (default 1)
 * - limit? (default 20)
 *
 * Respuestas:
 * - 200 { status:"ok", total, page, limit, items: [{ last_applied_at, candidate:{..., cv_url} }] }
 * - 403/401 { status:"error", ... }
 * ============================================================================
 */
export async function listCandidatesForCompanyController(req, res) {
    try {
        const out = await listCandidatesForCompanyService(
            req.actor,
            req.params.company_id,
            req.query
        );
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/candidates/:candidate_id/cv
 * Descarga/visualización del CV del candidato (PDF)
 *
 * Nota para frontend:
 * - Este endpoint devuelve application/pdf.
 * - Si no existe CV: 404 con JSON { status:"no_cv" }.
 *
 * Respuestas:
 * - 200 (application/pdf)
 * - 404 { status:"no_cv" } o { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * ============================================================================
 */
export async function getCandidateCvController(req, res) {
    try {
        const out = await resolveCandidateCvService(req.actor, req.params.candidate_id);

        if (out.status === "not_found") {
            return res.status(404).json(out);
        }
        if (out.status === "no_cv") {
            return res.status(404).json(out);
        }

        return res.sendFile(out.file_path);
    } catch (err) {
        return sendError(res, err);
    }
}
