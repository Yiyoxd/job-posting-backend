// controllers/companyController.js

/**
 * ============================================================================
 * companyController.js — API HTTP de Empresas para consumo del Frontend
 * ============================================================================
 *
 * Identificadores (Frontend):
 * - :id siempre representa `company_id` (number).
 *
 * Endpoints:
 * - GET    /api/companies
 * - GET    /api/companies/:id
 * - GET    /api/companies/:id/jobs
 * - POST   /api/companies
 * - PUT    /api/companies/:id
 * - DELETE /api/companies/:id
 * - PUT    /api/companies/:id/logo
 *
 * Formatos de respuesta:
 * - Listado:
 *   { meta: { page, limit, total, totalPages }, data: Company[] }
 * - Detalle:
 *   Company
 * - Jobs de empresa:
 *   { meta: { page, limit, total, totalPages }, data: Job[] }
 *
 * Campo logo (Frontend):
 * - Company incluye `logo_full_path` (string | null).
 *
 * Autenticación (Frontend):
 * - GET: público
 * - POST/PUT/DELETE/LOGO: requiere Authorization: Bearer <token>
 *
 * Errores:
 * - JSON típico:
 *   { "error": string, "details"?: string }
 * ============================================================================
 */

import {
    listCompaniesService,
    getCompanyByIdService,
    getCompanyJobsService,
    createCompanyService,
    updateCompanyService,
    deleteCompanyService,
    updateCompanyLogoService
} from "../services/companyService.js";

/**
 * Responde errores del service con status code.
 *
 * Respuesta:
 * - { error: string } o { error: string, details?: string }
 *
 * @param {any} err
 * @param {import("express").Response} res
 * @param {string} fallbackMessage
 */
function respondServiceError(err, res, fallbackMessage) {
    const status = Number(err?.httpStatus);
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
        return res.status(status).json({ error: err.message || fallbackMessage });
    }

    return res.status(500).json({
        error: fallbackMessage,
        details: err?.message
    });
}

/* =============================================================================
 * GET /api/companies
 * =============================================================================
 */

/**
 * GET /api/companies
 *
 * Lista empresas con filtros, paginación y ordenamiento.
 * Si se envía `q` y NO se envía `sortBy`, se aplica ranking inteligente.
 *
 * Query params (opcionales, combinables):
 * - q: string
 *   Búsqueda por nombre/descripcion/ubicación (ranking inteligente si no hay sortBy).
 *
 * - country: string
 * - state: string
 * - city: string
 *
 * - min_size: number|string
 * - max_size: number|string
 *
 * - page: number|string (default: 1)
 * - limit: number|string (default: 20)
 *
 * - sortBy: "name" | "createdAt" | "country"
 * - sortDir: "asc" | "desc"
 *
 * Respuesta 200:
 * {
 *   "meta": { "page": number, "limit": number, "total": number, "totalPages": number },
 *   "data": Company[]
 * }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getCompanies(req, res) {
    try {
        const result = await listCompaniesService(req.query);
        return res.json(result);
    } catch (err) {
        return respondServiceError(err, res, "Error al obtener empresas");
    }
}

/* =============================================================================
 * GET /api/companies/:id
 * =============================================================================
 */

/**
 * GET /api/companies/:id
 *
 * Obtiene el detalle de una empresa por company_id.
 *
 * Path params:
 * - id: number|string (company_id)
 *
 * Respuesta 200:
 * - Company (incluye logo_full_path)
 *
 * Respuesta 404:
 * - { "error": "Empresa no encontrada" }
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getCompanyById(req, res) {
    try {
        const company = await getCompanyByIdService(req.params.id);

        if (!company) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(company);
    } catch (err) {
        return respondServiceError(err, res, "Error al obtener empresa");
    }
}

/* =============================================================================
 * GET /api/companies/:id/jobs
 * =============================================================================
 */

/**
 * GET /api/companies/:id/jobs
 *
 * Lista empleos publicados por una empresa (company_id).
 *
 * Path params:
 * - id: number|string (company_id)
 *
 * Query params (opcionales):
 * - page: number|string (default: 1)
 * - limit: number|string (default: 20)
 * - country: string
 * - state: string
 * - city: string
 * - work_type: string
 * - pay_period: string
 *
 * Respuesta 200:
 * {
 *   "meta": { "page": number, "limit": number, "total": number, "totalPages": number },
 *   "data": Job[]
 * }
 *
 * Nota para Front:
 * - Este endpoint NO adjunta `company` dentro de cada Job; regresa los jobs planos.
 *
 * Errores:
 * - 500: { error, details }
 */
export async function getCompanyJobs(req, res) {
    try {
        const companyId = req.params.id;

        const result = await getCompanyJobsService(companyId, req.query);
        return res.json(result);
    } catch (err) {
        return respondServiceError(err, res, "Error al obtener empleos de la empresa");
    }
}

/* =============================================================================
 * POST /api/companies
 * =============================================================================
 */

/**
 * POST /api/companies
 *
 * Crea una empresa.
 *
 * Auth (Frontend):
 * - Requiere Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : permitido
 * - company: permitido SOLO si esa cuenta aún no tiene perfil de empresa
 *
 * Body (JSON):
 * - Campos del modelo Company (ejemplos):
 *   {
 *     "name": string,
 *     "description": string,
 *     "country": string,
 *     "state": string,
 *     "city": string,
 *     "address": string,
 *     "company_size_min": number,
 *     "company_size_max": number
 *   }
 *
 * Respuesta 201:
 * - Company (incluye logo_full_path)
 *
 * Errores típicos:
 * - 401/403: sin permisos / token inválido
 * - 409: ya existe perfil de empresa para esa cuenta
 * - 500: { error, details }
 */
export async function createCompany(req, res) {
    try {
        const company = await createCompanyService(req.actor, req.body);
        return res.status(201).json(company);
    } catch (err) {
        return respondServiceError(err, res, "Error al crear empresa");
    }
}

/* =============================================================================
 * PUT /api/companies/:id
 * =============================================================================
 */

/**
 * PUT /api/companies/:id
 *
 * Actualiza una empresa por company_id.
 *
 * Auth (Frontend):
 * - Requiere Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : puede actualizar cualquier empresa
 * - company: solo su propia empresa (según token)
 *
 * Path params:
 * - id: number|string (company_id)
 *
 * Body (JSON):
 * - Campos a actualizar (parcial).
 *
 * Respuesta 200:
 * - Company actualizado (incluye logo_full_path)
 *
 * Respuesta 404:
 * - { "error": "Empresa no encontrada" }
 *
 * Errores típicos:
 * - 401/403
 * - 500
 */
export async function updateCompany(req, res) {
    try {
        const updated = await updateCompanyService(req.actor, req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(updated);
    } catch (err) {
        return respondServiceError(err, res, "Error al actualizar empresa");
    }
}

/* =============================================================================
 * DELETE /api/companies/:id
 * =============================================================================
 */

/**
 * DELETE /api/companies/:id
 *
 * Elimina una empresa por company_id.
 *
 * Auth (Frontend):
 * - Requiere Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : puede eliminar cualquier empresa
 * - company: solo su propia empresa
 *
 * Path params:
 * - id: number|string (company_id)
 *
 * Respuesta 200:
 * - { "message": "Empresa eliminada correctamente" }
 *
 * Respuesta 404:
 * - { "error": "Empresa no encontrada" }
 *
 * Errores típicos:
 * - 401/403
 * - 500
 */
export async function deleteCompany(req, res) {
    try {
        const { deleted } = await deleteCompanyService(req.actor, req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json({ message: "Empresa eliminada correctamente" });
    } catch (err) {
        return respondServiceError(err, res, "Error al eliminar empresa");
    }
}

/* =============================================================================
 * PUT /api/companies/:id/logo
 * =============================================================================
 */

/**
 * PUT /api/companies/:id/logo
 *
 * Actualiza el logo de una empresa (company_id).
 *
 * Auth (Frontend):
 * - Requiere Authorization: Bearer <token>
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Field file: "logo"
 *
 * Ejemplo (fetch):
 *   const form = new FormData();
 *   form.append("logo", file);
 *   await fetch(`/api/companies/${companyId}/logo`, {
 *     method: "PUT",
 *     headers: { Authorization: `Bearer ${token}` },
 *     body: form
 *   });
 *
 * Respuesta 200:
 * - Company (incluye logo_full_path)
 *
 * Errores típicos:
 * - 400: falta archivo "logo"
 * - 401/403: sin permisos
 * - 404: empresa no existe
 * - 500: { error, details }
 */
export async function updateCompanyLogo(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                error: "Falta archivo 'logo' (multipart/form-data)"
            });
        }

        const updated = await updateCompanyLogoService(req.actor, req.params.id, req.file.buffer);

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(updated);
    } catch (err) {
        return respondServiceError(err, res, "Error al actualizar logo de la empresa");
    }
}
