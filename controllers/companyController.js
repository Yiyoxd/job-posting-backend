/**
 * ============================================================================
 *  companyController.js — CONTROLADOR DE EMPRESAS
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
 * ============================================================================
 */

import Company from "../models/Company.js";
import Job from "../models/Job.js";

function parseNumber(value) {
    if (value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * Construye filtros para la entidad Company a partir de req.query.
 */
function buildCompanyFilters(queryParams = {}) {
    const {
        q,
        country,
        state,
        city,
        min_size,
        max_size
    } = queryParams;

    const filter = {};

    // Búsqueda por texto (nombre / descripción)
    if (q && q.trim()) {
        const regex = new RegExp(q.trim(), "i");
        filter.$or = [
            { name: regex },
            { description: regex }
        ];
    }

    // Filtros por ubicación
    if (country) filter.country = country;
    if (state)   filter.state = state;
    if (city)    filter.city = city;

    // Filtros por tamaño de empresa
    const minSize = parseNumber(min_size);
    const maxSize = parseNumber(max_size);

    // Si tenemos tamaño mínimo, pedimos empresas cuyo company_size_max >= minSize
    if (minSize !== null) {
        filter.company_size_max = { ...(filter.company_size_max || {}), $gte: minSize };
    }

    // Si tenemos tamaño máximo, pedimos empresas cuyo company_size_min <= maxSize
    if (maxSize !== null) {
        filter.company_size_min = { ...(filter.company_size_min || {}), $lte: maxSize };
    }

    return filter;
}

/**
 * Construye objeto sort para Company.
 */
function buildCompanySort(queryParams = {}) {
    const { sortBy, sortDir } = queryParams;

    const allowed = new Set(["name", "createdAt", "country"]);
    const field = allowed.has(sortBy) ? sortBy : "name";
    const direction = sortDir === "desc" ? -1 : 1;

    return { [field]: direction };
}

/* =============================================================================
 *  GET /api/companies — Listado con filtros, paginación y ordenamiento
 * =============================================================================
 */
export async function getCompanies(req, res) {
    try {
        const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
        const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
        const skip  = (page - 1) * limit;

        const filters = buildCompanyFilters(req.query);
        const sort    = buildCompanySort(req.query);

        const [total, companies] = await Promise.all([
            Company.countDocuments(filters),
            Company.find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            meta: {
                page,
                limit,
                total,
                totalPages
            },
            data: companies
        });

    } catch (err) {
        res.status(500).json({
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
        const company = await Company.findById(req.params.id);

        if (!company) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        res.json(company);

    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/companies/:id/jobs — Empleos de una empresa
 * -----------------------------------------------------------------------------
 *  Soporta los mismos filtros que getJobs, excepto company_id (forzado aquí).
 * =============================================================================
 */
export async function getCompanyJobs(req, res) {
    try {
        const companyId = req.params.id;

        const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
        const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
        const skip  = (page - 1) * limit;

        // Reutilizamos la lógica de filtros de jobs importándola aquí si quieres,
        // pero para no hacer import cruzado, haremos una versión sencilla.
        const { country, state, city, work_type, pay_period } = req.query;

        const filters = { company_id: companyId };

        if (country)   filters.country = country;
        if (state)     filters.state = state;
        if (city)      filters.city = city;
        if (work_type) filters.work_type = work_type;
        if (pay_period) filters.pay_period = pay_period;

        const [total, jobs] = await Promise.all([
            Job.countDocuments(filters),
            Job.find(filters)
                .sort({ listed_time: -1 })
                .skip(skip)
                .limit(limit)
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            meta: {
                page,
                limit,
                total,
                totalPages
            },
            data: jobs
        });

    } catch (err) {
        res.status(500).json({
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
        const [countries, states, cities] = await Promise.all([
            Company.distinct("country"),
            Company.distinct("state"),
            Company.distinct("city"),
        ]);

        res.json({
            countries: countries.filter(Boolean).sort(),
            states:    states.filter(Boolean).sort(),
            cities:    cities.filter(Boolean).sort()
        });

    } catch (err) {
        res.status(500).json({
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
        const company = await Company.create(req.body);
        res.status(201).json(company);

    } catch (err) {
        res.status(500).json({
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
        const updated = await Company.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        res.json(updated);

    } catch (err) {
        res.status(500).json({
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
        const deleted = await Company.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        res.json({ message: "Empresa eliminada correctamente" });

    } catch (err) {
        res.status(500).json({
            error: "Error al eliminar empresa",
            details: err.message
        });
    }
}
