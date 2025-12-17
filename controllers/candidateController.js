// controllers/candidateController.js

/**
 * ============================================================================
 * candidateController.js — Controlador HTTP de Candidatos
 * ============================================================================
 *
 * IMPORTANTE (flujo de tu sistema):
 * - El perfil Candidate se crea en /api/auth/register cuando type="candidate".
 * - Este controlador NO expone "crear candidato" por POST /api/candidates.
 *
 * Requisito de autenticación:
 * - Debe existir req.actor con la forma:
 *   {
 *     user_id: number,
 *     type: "candidate" | "company" | "admin",
 *     candidate_id?: number | null,
 *     company_id?: number | null
 *   }
 *
 * Formato de respuesta:
 * - OK:    { status: "...", ...payload }
 * - Error: { status: "error", code: string, message: string }
 *
 * Status HTTP:
 * - Se deriva de err.httpStatus cuando exista; default 500.
 */

import {
    getCandidateByIdService,
    updateCandidateService,
    listCandidatesForCompanyService,
    resolveCandidateCvService,
    uploadCandidateCvService
} from "../services/candidateService.js";

/* =============================================================================
 * Helpers de respuesta
 * =============================================================================
 */
function sendOk(res, body) {
    return res.status(200).json(body);
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
 * GET /api/candidates/:candidate_id
 * Obtiene perfil de candidato (según permisos del actor)
 *
 * Respuestas:
 * - 200 { status:"ok", candidate: {..., cv_url } }
 * - 200 { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * =============================================================================
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
 * Body:
 * - solo campos presentes se actualizan:
 *   full_name?, contact?, country?, state?, city?, headline?
 *
 * Respuestas:
 * - 200 { status:"ok", candidate: {..., cv_url } }
 * - 200 { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * =============================================================================
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
 * =============================================================================
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
 * Respuestas:
 * - 200 (application/pdf)
 * - 404 { status:"no_cv" } o { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * =============================================================================
 */
export async function getCandidateCvController(req, res) {
    try {
        const out = await resolveCandidateCvService(req.actor, req.params.candidate_id);

        if (out.status === "not_found") return res.status(404).json(out);
        if (out.status === "no_cv") return res.status(404).json(out);

        return res.sendFile(out.file_path);
    } catch (err) {
        return sendError(res, err);
    }
}


/* =============================================================================
 * POST /api/candidates/:candidate_id/cv
 * Subida del CV del candidato (PDF)
 *
 * Reglas:
 * - SOLO el candidato dueño puede subir su propio CV
 *
 * Espera:
 * - multipart/form-data
 * - req.file (PDF)
 *
 * Respuestas:
 * - 200 { status:"ok", cv_url }
 * - 404 { status:"not_found" }
 * - 403/401 { status:"error", ... }
 * =============================================================================
 */
export async function uploadCandidateCvController(req, res) {
    try {
        const out = await uploadCandidateCvService(
            req.actor,
            req.params.candidate_id,
            req.file
        );

        return res.status(200).json(out);
    } catch (err) {
        const httpStatus = err?.httpStatus || 500;
        const code = err?.code || "internal_error";
        const message = err?.message || "Error interno.";

        return res.status(httpStatus).json({
            status: "error",
            code,
            message
        });
    }
}
