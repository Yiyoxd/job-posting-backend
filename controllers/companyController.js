/**
 * ============================================================================
 *  companyController.js — CONTROLADOR DE EMPRESAS (DELGADO + RANKER PRO)
 * ============================================================================
 *
 * Endpoints (ver companyRoutes.js):
 *
 *   GET  /api/companies
 *        → Listar empresas con filtros, paginación y ordenamiento.
 *
 *   GET  /api/companies/:id
 *        → Obtener una empresa por ID.
 *
 *   GET  /api/companies/:id/jobs
 *        → Obtener empleos de una empresa (con filtros + paginación).
 *
 *   GET  /api/companies/filters/options
 *        → Obtener opciones para filtros de empresas.
 *
 *   POST /api/companies
 *        → Crear empresa.
 *
 *   PUT  /api/companies/:id
 *        → Actualizar empresa.
 *
 *   DELETE /api/companies/:id
 *        → Eliminar empresa.
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
 *   - page, limit (igual que en jobs)
 *   - sortBy  → name | createdAt | country
 *   - sortDir → asc | desc
 *
 * IMPORTANTE PARA EL FRONTEND:
 * -----------------------------
 * 1. GET /api/companies
 *    Respuesta:
 *      {
 *        "meta": { page, limit, total, totalPages },
 *        "data": [
 *          {
 *            ...campos de Company...
 *            "logo_full_path": "https://tu-backend.com/company_logos/processed/268.png"
 *          },
 *          ...
 *        ]
 *      }
 *
 *    - Cuando el cliente ENVÍA q y NO envía sortBy:
 *        → Los resultados vienen ordenados por RELEVANCIA (ranker avanzado).
 *
 *    - Cuando NO envía q, o envía q + sortBy:
 *        → Se respeta sortBy/sortDir y q se aplica como filtro regex simple.
 *
 * 2. GET /api/companies/:id
 *    Respuesta:
 *      {
 *        ...campos de Company...
 *        "logo_full_path": "..."
 *      }
 *
 * 3. POST /api/companies, PUT /api/companies/:id
 *    También regresan la empresa con logo_full_path.
 * ============================================================================
 */

import {
    listCompaniesService,
    getCompanyByIdService,
    getCompanyJobsService,
    getCompanyFilterOptionsService,
    createCompanyService,
    updateCompanyService,
    deleteCompanyService
} from "../services/companyService.js";

/* =============================================================================
 *  GET /api/companies — Listado con filtros, paginación y rank inteligente
 * =============================================================================
 */
export async function getCompanies(req, res) {
    try {
        const result = await listCompaniesService(req.query);

        // result ya viene en formato:
        // { meta: {...}, data: [ { ...company, logo_full_path }, ... ] }
        return res.json(result);

    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener empresas",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/companies/:id — Empresa por ID
 * =============================================================================
 */
export async function getCompanyById(req, res) {
    try {
        const company = await getCompanyByIdService(req.params.id);

        if (!company) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        // company ya incluye logo_full_path
        return res.json(company);

    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/companies/:id/jobs — Empleos de una empresa
 * ----------------------------------------------------------------------------- *
 *  Soporta los mismos filtros que tenías:
 *   - country
 *   - state
 *   - city
 *   - work_type
 *   - pay_period
 *
 *  La respuesta se mantiene:
 *    {
 *      meta: { page, limit, total, totalPages },
 *      data: [ ...jobs ]
 *    }
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
 *  GET /api/companies/filters/options — Opciones de filtros
 * =============================================================================
 */
export async function getCompanyFilterOptions(req, res) {
    try {
        const options = await getCompanyFilterOptionsService();

        // options:
        // {
        //   countries: string[],
        //   states:    string[],
        //   cities:    string[]
        // }
        return res.json(options);

    } catch (err) {
        return res.status(500).json({
            error: "Error al obtener opciones de filtros para empresas",
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

        // company ya viene con logo_full_path
        return res.status(201).json(company);

    } catch (err) {
        return res.status(500).json({
            error: "Error al crear empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  PUT /api/companies/:id — Actualizar empresa
 * =============================================================================
 */
export async function updateCompany(req, res) {
    try {
        const updated = await updateCompanyService(req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        // updated ya viene con logo_full_path
        return res.json(updated);

    } catch (err) {
        return res.status(500).json({
            error: "Error al actualizar empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  DELETE /api/companies/:id — Eliminar empresa
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
