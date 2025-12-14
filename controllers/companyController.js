/**
 * ============================================================================
 *  companyController.js — CONTROLADOR DE EMPRESAS (DELGADO + RANKER PRO)
 * ============================================================================
 *
 * ✅ IMPORTANTE (API pública):
 * - El parámetro :id en estas rutas se interpreta como company_id (numérico).
 *
 * Endpoints (ver companyRoutes.js):
 *
 *   GET  /api/companies
 *        → Listar empresas con filtros, paginación y ordenamiento.
 *
 *   GET  /api/companies/:id
 *        → Obtener una empresa por company_id.
 *
 *   GET  /api/companies/:id/jobs
 *        → Obtener empleos de una empresa (company_id) con filtros + paginación.
 *
 *   GET  /api/companies/filters/options
 *        → Obtener opciones para filtros de empresas.
 *
 *   POST /api/companies
 *        → Crear empresa.
 *
 *   PUT  /api/companies/:id
 *        → Actualizar empresa por company_id.
 *
 *   DELETE /api/companies/:id
 *        → Eliminar empresa por company_id.
 *
 *   PUT /api/companies/:id/logo
 *        → Actualizar logo por company_id.
 *
 * Filtros en GET /api/companies:
 *   - q          → Búsqueda por nombre / descripción
 *   - country    → País
 *   - state      → Estado
 *   - city       → Ciudad
 *   - min_size   → Tamaño mínimo (company_size_max >= min_size)
 *   - max_size   → Tamaño máximo (company_size_min <= max_size)
 *
 * Paginación y orden:
 *   - page, limit
 *   - sortBy  → name | createdAt | country
 *   - sortDir → asc | desc
 *
 * Respuestas:
 * - Listado: { meta, data: [ { ...company, logo_full_path }, ... ] }
 * - Lectura/CRUD: { ...company, logo_full_path }
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

/* =============================================================================
 *  GET /api/companies — Listado con filtros, paginación y rank inteligente
 * =============================================================================
 */
export async function getCompanies(req, res) {
    try {
        const result = await listCompaniesService(req.query);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener empresas",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/companies/:id — Empresa por company_id
 * =============================================================================
 */
export async function getCompanyById(req, res) {
    try {
        const company = await getCompanyByIdService(req.params.id);

        if (!company) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(company);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/companies/:id/jobs — Empleos de una empresa (company_id)
 * =============================================================================
 */
export async function getCompanyJobs(req, res) {
    try {
        const companyId = req.params.id;

        const result = await getCompanyJobsService(companyId, req.query);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener empleos de la empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  POST /api/companies — Crear empresa
 * =============================================================================
 */
export async function createCompany(req, res) {
    try {
        const company = await createCompanyService(req.body);
        return res.status(201).json(company);
    } catch (err) {
        return res.status(500).json({
            error: "Error al crear empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  PUT /api/companies/:id — Actualizar empresa por company_id
 * =============================================================================
 */
export async function updateCompany(req, res) {
    try {
        const updated = await updateCompanyService(req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(updated);
    } catch (err) {
        return res.status(500).json({
            error: "Error al actualizar empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  DELETE /api/companies/:id — Eliminar empresa por company_id
 * =============================================================================
 */
export async function deleteCompany(req, res) {
    try {
        const { deleted } = await deleteCompanyService(req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json({ message: "Empresa eliminada correctamente" });
    } catch (err) {
        return res.status(500).json({
            error: "Error al eliminar empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  PUT /api/companies/:id/logo — Actualizar logo por company_id
 * =============================================================================
 *
 * Request:
 *   - multipart/form-data
 *   - field "logo" (file)
 *
 * Resultado:
 *   - Regresa la empresa con logo_full_path (misma forma que /:id)
 */
export async function updateCompanyLogo(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                error: "Falta archivo 'logo' (multipart/form-data)"
            });
        }

        const updated = await updateCompanyLogoService(req.params.id, req.file.buffer);

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        return res.json(updated);
    } catch (err) {
        return res.status(500).json({
            error: "Error al actualizar logo de la empresa",
            details: err.message
        });
    }
}
