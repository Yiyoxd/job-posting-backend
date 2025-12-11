/**
 * ============================================================================
 *  jobController.js — CONTROLADOR DE EMPLEOS
 * ============================================================================
 *
 * Maneja toda la lógica de la entidad Job:
 *
 * Endpoints (ver jobRoutes.js):
 *
 *   GET  /api/jobs
 *        → Listar empleos con filtros, paginación y ordenamiento.
 *
 *   GET  /api/jobs/:id
 *        → Obtener un empleo por su ID.
 *
 *   GET  /api/jobs/company/:companyId
 *        → Listar empleos publicados por una empresa específica, con filtros.
 *
 *   GET  /api/jobs/filters/options
 *        → Obtener opciones/distincts para construir filtros en el frontend.
 *
 *   POST /api/jobs
 *        → Crear un nuevo empleo.
 *
 *   PUT  /api/jobs/:id
 *        → Actualizar un empleo existente.
 *
 *   DELETE /api/jobs/:id
 *        → Eliminar un empleo.
 *
 * Filtros soportados en GET /api/jobs y GET /api/jobs/company/:companyId:
 *   - q                → Búsqueda por texto (title, description)
 *   - country          → País
 *   - state            → Estado
 *   - city             → Ciudad
 *   - work_type        → Tipo de trabajo (full-time, remote, etc.)
 *   - pay_period       → Período de pago (hourly, monthly, yearly, etc.)
 *   - min_salary       → Salario mínimo (filtra >= min_salary)
 *   - max_salary       → Salario máximo (filtra <= max_salary)
 *   - min_norm_salary  → normalized_salary mínimo
 *   - max_norm_salary  → normalized_salary máximo
 *   - listed_from      → Fecha mínima de publicación (YYYY-MM-DD)
 *   - listed_to        → Fecha máxima de publicación (YYYY-MM-DD)
 *
 * Paginación:
 *   - page  (1-based, default = 1)
 *   - limit (default = 20)
 *
 * Ordenamiento:
 *   - sortBy   → listed_time | min_salary | max_salary | normalized_salary | createdAt
 *   - sortDir  → asc | desc  (default = desc)
 *
 * Respuesta de listado:
 *   {
 *     meta: {
 *       page, limit, total, totalPages
 *     },
 *     data: [ ...jobs ]
 *   }
 * ============================================================================
 */

import Job from "../models/Job.js";

/**
 * Parsea un número desde query string. Devuelve null si no es válido.
 */
function parseNumber(value) {
    if (value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * Parsea una fecha YYYY-MM-DD (o ISO). Devuelve null si no es válida.
 */
function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Construye dinámicamente el objeto de filtros para Job.find().
 * Recibe los query params tal cual vienen de req.query.
 */
function buildJobFilters(queryParams = {}) {
    const {
        q,
        country,
        state,
        city,
        work_type,
        pay_period,
        company_id,
        min_salary,
        max_salary,
        min_norm_salary,
        max_norm_salary,
        listed_from,
        listed_to,
    } = queryParams;

    const filter = {};

    // Búsqueda por texto (título / descripción)
    if (q && q.trim()) {
        const regex = new RegExp(q.trim(), "i");
        filter.$or = [
            { title: regex },
            { description: regex }
        ];
    }

    // Filtros de ubicación
    if (country) filter.country = country;
    if (state)   filter.state = state;
    if (city)    filter.city = city;

    // Filtro por tipo de trabajo
    if (work_type) filter.work_type = work_type;

    // Filtro por período de pago
    if (pay_period) filter.pay_period = pay_period;

    // Filtro por empresa
    if (company_id) filter.company_id = company_id;

    // Filtros de salario "crudos"
    const minSalary = parseNumber(min_salary);
    const maxSalary = parseNumber(max_salary);

    if (minSalary !== null) {
        filter.min_salary = { ...(filter.min_salary || {}), $gte: minSalary };
    }
    if (maxSalary !== null) {
        filter.max_salary = { ...(filter.max_salary || {}), $lte: maxSalary };
    }

    // Filtros sobre normalized_salary
    const minNorm = parseNumber(min_norm_salary);
    const maxNorm = parseNumber(max_norm_salary);

    if (minNorm !== null) {
        filter.normalized_salary = { ...(filter.normalized_salary || {}), $gte: minNorm };
    }
    if (maxNorm !== null) {
        filter.normalized_salary = { ...(filter.normalized_salary || {}), $lte: maxNorm };
    }

    // Rango de fechas (listed_time)
    const fromDate = parseDate(listed_from);
    const toDate   = parseDate(listed_to);

    if (fromDate || toDate) {
        filter.listed_time = {};
        if (fromDate) filter.listed_time.$gte = fromDate;
        if (toDate)   filter.listed_time.$lte = toDate;
    }

    return filter;
}

/**
 * Construye el objeto de ordenamiento a partir de query params.
 */
function buildJobSort(queryParams = {}) {
    const { sortBy, sortDir } = queryParams;

    // Campos permitidos para ordenamiento
    const allowed = new Set([
        "listed_time",
        "min_salary",
        "max_salary",
        "normalized_salary",
        "createdAt"
    ]);

    const field = allowed.has(sortBy) ? sortBy : "listed_time";
    const direction = sortDir === "asc" ? 1 : -1;

    return { [field]: direction };
}

/* =============================================================================
 *  GET /api/jobs — Listado de empleos con filtros, paginación y ordenamiento
 * =============================================================================
 */
export async function getJobs(req, res) {
    try {
        const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
        const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
        const skip  = (page - 1) * limit;

        const filters = buildJobFilters(req.query);
        const sort    = buildJobSort(req.query);

        const [total, jobs] = await Promise.all([
            Job.countDocuments(filters),
            Job.find(filters)
                .populate("company_id", "name country state city url")
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
            data: jobs
        });

    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empleos",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/jobs/:id — Obtener un empleo por su ID
 * =============================================================================
 */
export async function getJobById(req, res) {
    try {
        const job = await Job.findById(req.params.id)
            .populate("company_id", "name country state city url");

        if (!job) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(job);

    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/jobs/company/:companyId — Empleos por empresa (con filtros)
 * -----------------------------------------------------------------------------
 *  Adicionalmente a los filtros de getJobs, aquí se fuerza company_id.
 * =============================================================================
 */
export async function getJobsByCompany(req, res) {
    try {
        const companyId = req.params.companyId;

        const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
        const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
        const skip  = (page - 1) * limit;

        const baseFilters = buildJobFilters(req.query);
        const filters = { ...baseFilters, company_id: companyId };
        const sort    = buildJobSort(req.query);

        const [total, jobs] = await Promise.all([
            Job.countDocuments(filters),
            Job.find(filters)
                .populate("company_id", "name country state city url")
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
 *  GET /api/jobs/filters/options — Opciones de filtros (distincts)
 * -----------------------------------------------------------------------------
 *  Útil para construir combos y multiselects en el frontend.
 *
 *  Respuesta:
 *    {
 *      countries: [...],
 *      states: [...],
 *      cities: [...],
 *      work_types: [...],
 *      pay_periods: [...]
 *    }
 * =============================================================================
 */
export async function getJobFilterOptions(req, res) {
    try {
        const [
            countries,
            states,
            cities,
            workTypes,
            payPeriods
        ] = await Promise.all([
            Job.distinct("country"),
            Job.distinct("state"),
            Job.distinct("city"),
            Job.distinct("work_type"),
            Job.distinct("pay_period")
        ]);

        res.json({
            countries: countries.filter(Boolean).sort(),
            states:    states.filter(Boolean).sort(),
            cities:    cities.filter(Boolean).sort(),
            work_types: workTypes.filter(Boolean).sort(),
            pay_periods: payPeriods.filter(Boolean).sort()
        });

    } catch (err) {
        res.status(500).json({
            error: "Error al obtener opciones de filtros",
            details: err.message
        });
    }
}

/* =============================================================================
 *  POST /api/jobs — Crear un nuevo empleo
 * =============================================================================
 */
export async function createJob(req, res) {
    try {
        const job = await Job.create(req.body);
        res.status(201).json(job);

    } catch (err) {
        res.status(500).json({
            error: "Error al crear empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  PUT /api/jobs/:id — Actualizar un empleo
 * =============================================================================
 */
export async function updateJob(req, res) {
    try {
        const updated = await Job.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(updated);

    } catch (err) {
        res.status(500).json({
            error: "Error al actualizar empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  DELETE /api/jobs/:id — Eliminar un empleo
 * =============================================================================
 */
export async function deleteJob(req, res) {
    try {
        const deleted = await Job.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json({ message: "Empleo eliminado correctamente" });

    } catch (err) {
        res.status(500).json({
            error: "Error al eliminar empleo",
            details: err.message
        });
    }
}
