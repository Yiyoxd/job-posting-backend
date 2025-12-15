/**
 * ============================================================================
 * jobController.js — API HTTP de Empleos (Jobs) para consumo del Frontend
 * ============================================================================
 *
 * Este archivo define el contrato HTTP que consume el frontend.
 * Aquí se documenta ÚNICAMENTE lo que el frontend necesita saber:
 * - Endpoints disponibles
 * - Query params / Path params / Body
 * - Respuestas (status codes + shapes)
 * - Reglas de autenticación y permisos (qué debe mandar el front)
 *
 * Autenticación (para Front):
 * - Endpoints GET: públicos (NO requieren token).
 * - Endpoints POST/PUT/DELETE: requieren token (Authorization: Bearer <token>).
 *
 * Errores (formato estable):
 * - Cuando ocurre un error controlado, se responde:
 *   {
 *     "error":   string,   // mensaje general apto para UI
 *     "details": string    // detalle técnico breve (opcional)
 *   }
 *
 * Recursos:
 * - Job se identifica por `job_id` (numérico incremental).
 * - Company se identifica por `company_id` (numérico incremental).
 * ============================================================================
 */

import {
    getJobsService,
    getJobByIdService,
    getJobsByCompanyService,
    getJobFilterOptionsService,
    getJobTitleRecommendationsService,
    createJobService,
    updateJobService,
    deleteJobService
} from "../services/jobService.js";

/**
 * Envía errores del service al frontend con status code correcto.
 *
 * Respuesta:
 * - { error: string, details: string }
 *
 * @param {import("express").Response} res
 * @param {any} err
 * @param {string} fallbackMessage
 */
function sendServiceError(res, err, fallbackMessage) {
    const status = Number(err?.httpStatus) || 500;
    res.status(status).json({
        error: fallbackMessage,
        details: err?.message || "Unexpected error"
    });
}

/* =============================================================================
 * GET /api/jobs
 * =============================================================================
 */

/**
 * GET /api/jobs
 *
 * Lista empleos con filtros, paginación y ordenamiento.
 * Si se envía `q` y NO se envía `sortBy`, se aplica ranking avanzado (relevancia).
 *
 * Query params (opcionales, combinables):
 * - q: string
 *   Texto de búsqueda (title/description).
 *
 * - country: string
 * - state: string
 * - city: string
 * - work_type: string
 * - work_location_type: "ONSITE" | "HYBRID" | "REMOTE"
 * - pay_period: string
 * - company_id: number|string
 *
 * - min_salary: number|string
 * - max_salary: number|string
 * - min_norm_salary: number|string
 * - max_norm_salary: number|string
 *
 * - listed_from: string (YYYY-MM-DD)
 * - listed_to:   string (YYYY-MM-DD)
 *
 * - page:  number|string (default: 1)
 * - limit: number|string (default: 20)
 *
 * - sortBy: "listed_time" | "min_salary" | "max_salary" | "normalized_salary" | "createdAt"
 * - sortDir: "asc" | "desc" (default: "desc")
 *
 * - include_company: "true" | "false" (default: "true")
 *   Si "false", el backend NO adjunta el objeto `company` en cada job.
 *
 * Respuesta 200:
 * {
 *   "meta": {
 *     "page": number,
 *     "limit": number,
 *     "total": number,
 *     "totalPages": number
 *   },
 *   "data": Array<Job>
 * }
 *
 * Donde Job incluye (si include_company=true):
 * - company: {
 *     ...,
 *     logo: string // URL absoluta
 *   }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getJobs(req, res) {
    try {
        const result = await getJobsService(req.query);

        res.json({
            meta: result.meta,
            data: result.data
        });
    } catch (err) {
        sendServiceError(res, err, "Error al obtener empleos");
    }
}

/* =============================================================================
 * GET /api/jobs/:id
 * =============================================================================
 */

/**
 * GET /api/jobs/:id
 *
 * Obtiene el detalle de un empleo por `job_id`.
 *
 * Path params:
 * - id: number|string
 *
 * Query params:
 * - include_company: "true" | "false" (default: "true")
 *
 * Respuesta 200:
 * Job
 *
 * Respuesta 404:
 * { "error": "Empleo no encontrado" }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getJobById(req, res) {
    try {
        const includeCompany =
            String(req.query.include_company ?? "true").toLowerCase() !== "false";

        const job = await getJobByIdService(req.params.id, { includeCompany });

        if (!job) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(job);
    } catch (err) {
        sendServiceError(res, err, "Error al obtener empleo");
    }
}

/* =============================================================================
 * GET /api/jobs/company/:companyId
 * =============================================================================
 */

/**
 * GET /api/jobs/company/:companyId
 *
 * Lista empleos de una empresa específica (company_id fijo).
 * Soporta los mismos query params que GET /api/jobs, excepto `company_id`
 * (se ignora si viene).
 *
 * Path params:
 * - companyId: number|string
 *
 * Query params:
 * - mismos que GET /api/jobs (excepto company_id)
 * - include_company: "true" | "false" (default: "true")
 *
 * Respuesta 200:
 * { "meta": { ... }, "data": Array<Job> }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getJobsByCompany(req, res) {
    try {
        const companyId = req.params.companyId;

        const result = await getJobsByCompanyService(companyId, req.query);

        res.json({
            meta: result.meta,
            data: result.data
        });
    } catch (err) {
        sendServiceError(res, err, "Error al obtener empleos de la empresa");
    }
}

/* =============================================================================
 * GET /api/jobs/filters/options
 * =============================================================================
 */

/**
 * GET /api/jobs/filters/options
 *
 * Devuelve valores únicos para construir selects/filtros en el frontend.
 *
 * Respuesta 200:
 * {
 *   "work_types": string[],
 *   "work_location_types": string[],
 *   "pay_periods": string[]
 * }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getJobFilterOptions(req, res) {
    try {
        const options = await getJobFilterOptionsService();
        res.json(options);
    } catch (err) {
        sendServiceError(res, err, "Error al obtener opciones de filtros");
    }
}

/* =============================================================================
 * GET /api/jobs/recommendations/titles
 * =============================================================================
 */

/**
 * GET /api/jobs/recommendations/titles
 *
 * Autocomplete/sugerencias de títulos basadas en `q`.
 *
 * Query params:
 * - q: string (recomendado; si falta/está vacío, regresa suggestions: [])
 * - limit: number|string (opcional, default: 10)
 *
 * Respuesta 200:
 * {
 *   "query": string,
 *   "suggestions": string[]
 * }
 *
 * Errores:
 * - Este endpoint intenta responder 200 incluso con q vacío.
 * - Otros errores se delegan al middleware de errores vía next(error).
 */
export async function getJobTitleRecommendations(req, res, next) {
    try {
        const { q, limit } = req.query;

        if (!q || typeof q !== "string" || !q.trim()) {
            return res.status(200).json({
                query: q ?? "",
                suggestions: []
            });
        }

        const parsedLimit = Number(limit);

        const safeLimit =
            Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

        const suggestions = await getJobTitleRecommendationsService(q, {
            limit: safeLimit
        });

        return res.status(200).json({
            query: q,
            suggestions
        });
    } catch (error) {
        next(error);
    }
}

/* =============================================================================
 * POST /api/jobs
 * =============================================================================
 */

/**
 * POST /api/jobs
 *
 * Crea un empleo.
 *
 * Auth:
 * - Requiere Authorization: Bearer <token>
 *
 * Body (JSON):
 * - Campos del Job (ejemplos comunes):
 *   {
 *     "title": string,
 *     "description": string,
 *     "min_salary": number,
 *     "max_salary": number,
 *     "pay_period": "HOURLY"|"WEEKLY"|"BIWEEKLY"|"MONTHLY"|"YEARLY",
 *     "currency": string,
 *     "work_type": string,
 *     "work_location_type": "ONSITE"|"HYBRID"|"REMOTE",
 *     "country": string,
 *     "state": string,
 *     "city": string,
 *     "listed_time": string|Date (opcional)
 *   }
 *
 * Nota para Front:
 * - Si el token pertenece a una EMPRESA, company_id se deriva del token.
 * - Si el token pertenece a un ADMIN, el backend requiere body.company_id.
 *
 * Respuesta 201:
 * - Job creado (formateado) y puede incluir `company` (según contrato del service).
 *
 * Errores típicos:
 * - 401: { error, details } (sin token / token inválido)
 * - 403: { error, details } (sin permisos)
 * - 400: { error, details } (admin sin company_id)
 * - 500: { error, details }
 */
export async function createJob(req, res) {
    try {
        const formatted = await createJobService(req.actor, req.body);
        res.status(201).json(formatted);
    } catch (err) {
        sendServiceError(res, err, "Error al crear empleo");
    }
}

/* =============================================================================
 * PUT /api/jobs/:id
 * =============================================================================
 */

/**
 * PUT /api/jobs/:id
 *
 * Actualiza un empleo por `job_id`.
 *
 * Auth:
 * - Requiere Authorization: Bearer <token>
 *
 * Path params:
 * - id: number|string
 *
 * Body (JSON):
 * - Campos a actualizar (parcial).
 *
 * Respuesta 200:
 * - Job actualizado (formateado)
 *
 * Respuesta 404:
 * - { "error": "Empleo no encontrado" }
 *
 * Errores típicos:
 * - 401: { error, details }
 * - 403: { error, details }
 * - 500: { error, details }
 */
export async function updateJob(req, res) {
    try {
        const formatted = await updateJobService(req.actor, req.params.id, req.body);

        if (!formatted) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(formatted);
    } catch (err) {
        sendServiceError(res, err, "Error al actualizar empleo");
    }
}

/* =============================================================================
 * DELETE /api/jobs/:id
 * =============================================================================
 */

/**
 * DELETE /api/jobs/:id
 *
 * Elimina un empleo por `job_id`.
 *
 * Auth:
 * - Requiere Authorization: Bearer <token>
 *
 * Path params:
 * - id: number|string
 *
 * Respuesta 200:
 * { "message": "Empleo eliminado correctamente" }
 *
 * Respuesta 404:
 * { "error": "Empleo no encontrado" }
 *
 * Errores típicos:
 * - 401: { error, details }
 * - 403: { error, details }
 * - 500: { error, details }
 */
export async function deleteJob(req, res) {
    try {
        const ok = await deleteJobService(req.actor, req.params.id);

        if (!ok) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json({ message: "Empleo eliminado correctamente" });
    } catch (err) {
        sendServiceError(res, err, "Error al eliminar empleo");
    }
}
