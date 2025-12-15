// controllers/applicationController.js

/**
 * ============================================================================
 * applicationController.js — Controlador HTTP de Postulaciones (Application)
 * ============================================================================
 *
 * Este controlador define el contrato HTTP para el frontend.
 *
 * Requisito de autenticación:
 * - Debe existir req.actor con la forma:
 *   { type: "candidate" | "company" | "admin", candidate_id?: number, company_id?: number }
 *
 * Respuestas JSON:
 * - Todas regresan un campo "status".
 * - En errores de autorización/validación:
 *   { status:"error", code, message }
 *
 * Notas para frontend:
 * - "not_found" y "no_cv" se regresan como JSON con HTTP 404 cuando corresponde.
 * - "invalid_status" se regresa como HTTP 200 con allowed[] para que el frontend valide.
 * ============================================================================
 */

import {
    createApplicationService,
    getApplicationByIdService,
    getCompanyApplicationDetailService,
    getApplicationStatusService,
    getStatusesForJobsService,
    listApplicationsByCandidateService,
    listApplicationsByCompanyService,
    listCompanyApplicationsWithCandidateService,
    updateApplicationStatusService,
    withdrawApplicationService,
    getCompanyPipelineCountsService
} from "../services/applicationService.js";

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

function sendNotFound(res, body) {
    return res.status(404).json(body);
}

function sendError(res, err) {
    const httpStatus = err?.httpStatus || 500;
    const code = err?.code || "internal_error";
    const message = err?.message || "Error interno.";
    return res.status(httpStatus).json({ status: "error", code, message });
}

/* =============================================================================
 * POST /api/applications
 * Crea una postulación
 *
 * Body:
 * - candidate_id (number)
 * - job_id (number)
 *
 * Respuestas:
 * - 201 { status:"created", application }
 * - 200 { status:"already_exists", application }
 * - 200 { status:"candidate_not_found" }
 * - 200 { status:"job_not_found" }
 * ============================================================================
 */
export async function createApplicationController(req, res) {
    try {
        const out = await createApplicationService(req.actor, req.body);

        if (out.status === "created") return sendCreated(res, out);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/applications/:application_id
 * Obtiene una postulación por ID
 *
 * Respuestas:
 * - 200 { status:"ok", application }
 * - 200 { status:"not_found" }
 * ============================================================================
 */
export async function getApplicationByIdController(req, res) {
    try {
        const out = await getApplicationByIdService(req.actor, req.params.application_id);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/companies/:company_id/applications/:application_id
 * Detalle de postulación para empresa (incluye candidato visible y cv_url)
 *
 * Respuestas:
 * - 200 { status:"ok", application, candidate }
 * - 404 { status:"not_found" }
 * ============================================================================
 */
export async function getCompanyApplicationDetailController(req, res) {
    try {
        const out = await getCompanyApplicationDetailService(req.actor, {
            company_id: req.params.company_id,
            application_id: req.params.application_id
        });

        if (out.status === "not_found") return sendNotFound(res, out);
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/applications/status
 * Status de un candidato para un job (o NOT_APPLIED)
 *
 * Query:
 * - candidate_id
 * - job_id
 *
 * Respuesta:
 * - 200 { status:"ok", application_status }
 * ============================================================================
 */
export async function getApplicationStatusController(req, res) {
    try {
        const out = await getApplicationStatusService(req.actor, {
            candidate_id: req.query.candidate_id,
            job_id: req.query.job_id
        });
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * POST /api/applications/statuses
 * Status en batch (job_id -> status) para un candidato
 *
 * Body:
 * - candidate_id (number)
 * - job_ids (number[])
 *
 * Respuesta:
 * - 200 { status:"ok", map }
 * ============================================================================
 */
export async function getStatusesForJobsController(req, res) {
    try {
        const out = await getStatusesForJobsService(req.actor, {
            candidate_id: req.body.candidate_id,
            job_ids: req.body.job_ids
        });
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/candidates/:candidate_id/applications
 * Lista postulaciones de un candidato
 *
 * Query:
 * - status?
 * - from? to?
 * - sortBy? sortDir?
 * - page? limit?
 *
 * Respuesta:
 * - 200 { status:"ok", total, page, limit, items }
 * ============================================================================
 */
export async function listApplicationsByCandidateController(req, res) {
    try {
        const out = await listApplicationsByCandidateService(
            req.actor,
            req.params.candidate_id,
            req.query
        );
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/companies/:company_id/applications
 * Lista postulaciones de una empresa (sin candidato)
 *
 * Query:
 * - job_id?
 * - status?
 * - from? to?
 * - sortBy? sortDir?
 * - page? limit?
 *
 * Respuesta:
 * - 200 { status:"ok", total, page, limit, items }
 * ============================================================================
 */
export async function listApplicationsByCompanyController(req, res) {
    try {
        const out = await listApplicationsByCompanyService(
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
 * GET /api/companies/:company_id/applications_with_candidates
 * Lista postulaciones de una empresa incluyendo candidato visible + cv_url
 *
 * Query:
 * - job_id?
 * - status?
 * - from? to?
 * - page? limit?
 *
 * Respuesta:
 * - 200 { status:"ok", total, page, limit, items }
 * ============================================================================
 */
export async function listCompanyApplicationsWithCandidateController(req, res) {
    try {
        const out = await listCompanyApplicationsWithCandidateService(
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
 * PATCH /api/companies/:company_id/applications/:application_id/status
 * Actualiza status de una postulación
 *
 * Body:
 * - status: "APPLIED"|"REVIEWING"|"INTERVIEW"|"OFFERED"|"REJECTED"|"HIRED"
 *
 * Respuestas:
 * - 200 { status:"ok", application }
 * - 200 { status:"invalid_status", allowed }
 * - 200 { status:"not_found" }
 * ============================================================================
 */
export async function updateApplicationStatusController(req, res) {
    try {
        const out = await updateApplicationStatusService(req.actor, {
            company_id: req.params.company_id,
            application_id: req.params.application_id,
            status: req.body.status
        });
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * DELETE /api/applications
 * Retira postulación (borra documento)
 *
 * Body:
 * - candidate_id
 * - job_id
 *
 * Respuestas:
 * - 200 { status:"deleted" }
 * - 200 { status:"not_found" }
 * ============================================================================
 */
export async function withdrawApplicationController(req, res) {
    try {
        const out = await withdrawApplicationService(req.actor, {
            candidate_id: req.body.candidate_id,
            job_id: req.body.job_id
        });
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}

/* =============================================================================
 * GET /api/companies/:company_id/applications/pipeline_counts
 * Conteos por status para una empresa
 *
 * Query:
 * - job_id?
 * - from? to?
 *
 * Respuesta:
 * - 200 { status:"ok", counts:[{status,count}] }
 * ============================================================================
 */
export async function getCompanyPipelineCountsController(req, res) {
    try {
        const out = await getCompanyPipelineCountsService(req.actor, {
            company_id: req.params.company_id,
            job_id: req.query.job_id,
            from: req.query.from,
            to: req.query.to
        });
        return sendOk(res, out);
    } catch (err) {
        return sendError(res, err);
    }
}
