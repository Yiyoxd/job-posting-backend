/**
 * ============================================================================
 *  jobController.js — CONTROLADOR DE EMPLEOS
 * ============================================================================
 *
 * Maneja toda la lógica de la entidad Job.
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
 * Filtros soportados (GET /api/jobs y GET /api/jobs/company/:companyId):
 *   - q                  → Búsqueda por texto (title, description)
 *   - country            → País
 *   - state              → Estado
 *   - city               → Ciudad
 *   - work_type          → Tipo de trabajo (FULL_TIME, CONTRACT, etc.)
 *   - work_location_type → Modalidad: ONSITE | HYBRID | REMOTE
 *   - pay_period         → Período de pago (HOURLY, MONTHLY, YEARLY, etc.)
 *   - company_id         → ID de empresa (solo en /api/jobs)
 *   - min_salary         → Salario mínimo (filtra min_salary >= min_salary)
 *   - max_salary         → Salario máximo (filtra max_salary <= max_salary)
 *   - min_norm_salary    → normalized_salary mínimo (>=)
 *   - max_norm_salary    → normalized_salary máximo (<=)
 *   - listed_from        → Fecha mínima de publicación (YYYY-MM-DD)
 *   - listed_to          → Fecha máxima de publicación (YYYY-MM-DD)
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
 *
 * Ranking de resultados (ALGORTIMO NUEVO):
 *   - Si hay q y NO se especifica sortBy:
 *       → Usa $text (índice de texto) + un score compuesto:
 *           * textScore de Mongo (con pesos en índice)
 *           * cuántas palabras de q aparecen en el título
 *           * cuántas en la descripción
 *           * si TODAS las palabras están en el título
 *           * si la frase completa q aparece en el título / descripción
 *           * pequeño boost por recencia (listed_time)
 *       → Ordena por finalScore y luego listed_time desc.
 *   - Si hay q y SÍ se especifica sortBy:
 *       → Búsqueda por regex (case-insensitive) en title/description
 *       → Ordena por sortBy/sortDir
 *   - Si no hay q:
 *       → Ordena por sortBy/sortDir o listed_time desc por defecto.
 * ============================================================================
 */

import Job from "../models/Job.js";

/* =============================================================================
 *  Helpers genéricos
 * =============================================================================
 */

/**
 * Parsea un número desde query string. Devuelve null si no es válido.
 */
function parseNumber(value) {
    if (value === undefined || value === null || value === "") return null;
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
 * Normaliza el término de búsqueda de texto (minusculas, espacios, etc).
 */
function normalizeSearchTerm(q) {
    if (q === undefined || q === null) return null;
    const s = String(q)
        .trim()
        .replace(/\s+/g, " ") // colapsa espacios
        .toLowerCase();
    return s.length ? s : null;
}

/**
 * Escapa caracteres especiales para regex.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Aplica un filtro numérico mínimo (campo >= valor).
 */
function applyNumericMinFilter(filter, fieldName, rawValue) {
    const min = parseNumber(rawValue);
    if (min === null) return;
    filter[fieldName] = {
        ...(filter[fieldName] || {}),
        $gte: min
    };
}

/**
 * Aplica un filtro numérico máximo (campo <= valor).
 */
function applyNumericMaxFilter(filter, fieldName, rawValue) {
    const max = parseNumber(rawValue);
    if (max === null) return;
    filter[fieldName] = {
        ...(filter[fieldName] || {}),
        $lte: max
    };
}

/**
 * Aplica un filtro de rango de fechas (from/to) sobre un campo Date.
 */
function addDateRangeFilter(filter, fieldName, fromRaw, toRaw) {
    const fromDate = parseDate(fromRaw);
    const toDate   = parseDate(toRaw);

    if (!fromDate && !toDate) return;

    filter[fieldName] = {};
    if (fromDate) filter[fieldName].$gte = fromDate;
    if (toDate)   filter[fieldName].$lte = toDate;
}

/**
 * Construye el objeto de paginación (page, limit, skip) a partir de query.
 */
function buildPaginationParams(queryParams = {}) {
    const page  = Math.max(parseInt(queryParams.page || "1", 10), 1);
    const limit = Math.max(parseInt(queryParams.limit || "20", 10), 1);
    const skip  = (page - 1) * limit;

    return { page, limit, skip };
}

/* =============================================================================
 *  Filtros base (todos menos q / ranking)
 * =============================================================================
 */

/**
 * Construye los filtros base para Job.find(), sin incluir la parte de "q".
 *
 * @param {Object} queryParams - req.query
 * @param {Object} options
 *   - includeCompanyFromQuery: si true, aplica company_id del query en /api/jobs
 */
function buildBaseJobFilters(
    queryParams = {},
    { includeCompanyFromQuery = true } = {}
) {
    const {
        country,
        state,
        city,
        work_type,
        work_location_type,
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

    // Filtros de ubicación
    if (country) filter.country = country;
    if (state)   filter.state   = state;
    if (city)    filter.city    = city;

    // Tipo de trabajo (FULL_TIME, CONTRACT, etc.)
    if (work_type) filter.work_type = work_type;

    // Modalidad de trabajo (ONSITE, HYBRID, REMOTE)
    if (work_location_type) {
        const upper = String(work_location_type).trim().toUpperCase();
        if (upper) {
            filter.work_location_type = upper;
        }
    }

    // Período de pago
    if (pay_period) filter.pay_period = pay_period;

    // Filtro por empresa desde query (solo en /api/jobs)
    if (includeCompanyFromQuery && company_id) {
        filter.company_id = company_id;
    }

    // Filtros de salario "crudos"
    // min_salary → min_salary >= min_salary
    // max_salary → max_salary <= max_salary
    applyNumericMinFilter(filter, "min_salary", min_salary);
    applyNumericMaxFilter(filter, "max_salary", max_salary);

    // Filtros sobre normalized_salary
    applyNumericMinFilter(filter, "normalized_salary", min_norm_salary);
    applyNumericMaxFilter(filter, "normalized_salary", max_norm_salary);

    // Rango de fechas (listed_time)
    addDateRangeFilter(filter, "listed_time", listed_from, listed_to);

    return filter;
}

/* =============================================================================
 *  Ordenamiento y ranking (fallback simple)
 * =============================================================================
 */

/**
 * Construye el objeto de ordenamiento por defecto (sin ranking avanzado).
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

/**
 * Construye el filtro final y el sort final cuando NO se usa ranking avanzado.
 *
 * @param {Object} queryParams - req.query
 * @param {Object} baseFilters - filtros base ya construidos (sin q)
 * @returns {{ filter: Object, sort: Object }}
 */
function buildJobQueryAndSort(queryParams = {}, baseFilters = {}) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    const filter = { ...baseFilters };
    let sort;

    if (safeQ && !hasCustomSort) {
        // MODO FULL-TEXT SIMPLE (solo si por alguna razón no se usa el avanzado)
        filter.$text = { $search: safeQ };

        sort = {
            score: { $meta: "textScore" },
            listed_time: -1
        };
    } else {
        // MODO REGEX (FALLBACK) O SIN q
        if (safeQ) {
            const regex = new RegExp(escapeRegex(safeQ), "i");
            filter.$or = [
                { title: regex },
                { description: regex }
            ];
        }

        sort = buildJobSort(queryParams);
    }

    return { filter, sort };
}

/* =============================================================================
 *  Ranking AVANZADO cuando hay q y NO hay sortBy
 * =============================================================================
 */

/**
 * Aplica un ranking avanzado usando aggregate cuando:
 *  - Hay q
 *  - Y el cliente NO envió sortBy
 *
 * Usa:
 *   - $text con índice de texto (title/description)
 *   - Cuántas palabras de q aparecen en el título/descripción
 *   - Si TODAS las palabras aparecen en el título
 *   - Si la frase completa aparece en el título/descripcion
 *   - Un pequeño boost por recencia (listed_time)
 */
async function listJobsRankedByQuery(queryParams = {}, {
    companyId = null,
    includeCompanyFromQuery = true
} = {}) {
    const { page, limit, skip } = buildPaginationParams(queryParams);
    const baseFilters = buildBaseJobFilters(queryParams, {
        includeCompanyFromQuery
    });

    if (companyId) {
        baseFilters.company_id = companyId;
    }

    const safeQ = normalizeSearchTerm(queryParams.q);
    if (!safeQ) {
        // Por seguridad, si algo raro pasa, cae al modo normal
        return listJobsSimple(queryParams, { companyId, includeCompanyFromQuery });
    }

    const tokens = safeQ.split(" ").filter(Boolean);
    const nowMs = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;

    // MATCH: filtros base + texto
    const matchStage = {
        $match: {
            ...baseFilters,
            $text: { $search: safeQ }
        }
    };

    // Etapa 1: preparar campos en minúsculas y textScore
    const addFieldsBase = {
        $addFields: {
            textScore: { $meta: "textScore" },
            titleLower: { $toLower: { $ifNull: ["$title", ""] } },
            descLower:  { $toLower: { $ifNull: ["$description", ""] } },
            listedTimeMs: {
                $cond: [
                    { $ifNull: ["$listed_time", false] },
                    { $toLong: "$listed_time" },
                    0
                ]
            }
        }
    };

    // Construir expresiones para tokens
    const titleTokenScoreExpr = {
        $add: tokens.map(t => ({
            $cond: [
                { $regexMatch: { input: "$titleLower", regex: escapeRegex(t) } },
                1,
                0
            ]
        }))
    };

    const descTokenScoreExpr = {
        $add: tokens.map(t => ({
            $cond: [
                { $regexMatch: { input: "$descLower", regex: escapeRegex(t) } },
                1,
                0
            ]
        }))
    };

    const allTermsInTitleExpr = {
        $cond: [
            {
                $and: tokens.map(t => ({
                    $regexMatch: { input: "$titleLower", regex: escapeRegex(t) }
                }))
            },
            1,
            0
        ]
    };

    const phraseRegexEscaped = escapeRegex(safeQ);

    const addFieldsScores = {
        $addFields: {
            titleTermScore: titleTokenScoreExpr,
            descTermScore:  descTokenScoreExpr,
            allTermsInTitle: allTermsInTitleExpr,
            phraseInTitle: {
                $cond: [
                    { $regexMatch: { input: "$titleLower", regex: phraseRegexEscaped } },
                    1,
                    0
                ]
            },
            phraseInDesc: {
                $cond: [
                    { $regexMatch: { input: "$descLower", regex: phraseRegexEscaped } },
                    1,
                    0
                ]
            },
            recencyBoost: {
                $let: {
                    vars: {
                        ageDays: {
                            $cond: [
                                { $gt: ["$listedTimeMs", 0] },
                                {
                                    $divide: [
                                        { $subtract: [nowMs, "$listedTimeMs"] },
                                        DAY_MS
                                    ]
                                },
                                365 // si no hay fecha, como si fuera viejo
                            ]
                        }
                    },
                    in: {
                        // Más nuevo → más puntos, tope a 60 días
                        $max: [
                            0,
                            { $subtract: [60, "$$ageDays"] }
                        ]
                    }
                }
            }
        }
    };

    const addFieldsFinalScore = {
        $addFields: {
            finalScore: {
                $add: [
                    { $multiply: ["$textScore", 5] },       // peso base de Mongo
                    { $multiply: ["$titleTermScore", 4] },   // tokens en título
                    { $multiply: ["$descTermScore", 1] },    // tokens en descripción
                    { $multiply: ["$allTermsInTitle", 15] }, // TODAS las palabras en título
                    { $multiply: ["$phraseInTitle", 25] },   // frase exacta en título
                    { $multiply: ["$phraseInDesc", 8] },     // frase exacta en descripción
                    "$recencyBoost"                          // boost por recencia
                ]
            }
        }
    };

    const sortStage = {
        $sort: {
            finalScore: -1,
            listed_time: -1
        }
    };

    const facetStage = {
        $facet: {
            data: [
                { $skip: skip },
                { $limit: limit }
            ],
            totalCount: [
                { $count: "count" }
            ]
        }
    };

    const pipeline = [
        matchStage,
        addFieldsBase,
        addFieldsScores,
        addFieldsFinalScore,
        sortStage,
        facetStage
    ];

    const aggResult = await Job.aggregate(pipeline);
    const facet = aggResult[0] || { data: [], totalCount: [] };

    const jobsRaw = facet.data || [];
    const total = (facet.totalCount[0] && facet.totalCount[0].count) || 0;

    // Simular populate("company_id", "name country state city url")
    const jobs = await Job.populate(jobsRaw, {
        path: "company_id",
        select: "name country state city url"
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: {
            page,
            limit,
            total,
            totalPages
        },
        data: jobs
    };
}

/* =============================================================================
 *  Core "simple" para listados (cuando no se usa ranking avanzado)
 * =============================================================================
 */
async function listJobsSimple(queryParams = {}, {
    companyId = null,
    includeCompanyFromQuery = true
} = {}) {
    const { page, limit, skip } = buildPaginationParams(queryParams);

    const baseFilters = buildBaseJobFilters(queryParams, {
        includeCompanyFromQuery
    });

    if (companyId) {
        baseFilters.company_id = companyId;
    }

    const { filter, sort } = buildJobQueryAndSort(queryParams, baseFilters);

    const [total, jobs] = await Promise.all([
        Job.countDocuments(filter),
        Job.find(filter)
            .populate("company_id", "name country state city url")
            .sort(sort)
            .skip(skip)
            .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: {
            page,
            limit,
            total,
            totalPages
        },
        data: jobs
    };
}

/* =============================================================================
 *  Core general para listados (decide si usa ranking avanzado o simple)
 * =============================================================================
 */
async function listJobs(queryParams = {}, {
    companyId = null,
    includeCompanyFromQuery = true
} = {}) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    // Si hay q y NO hay sortBy → usamos ranking avanzado
    if (safeQ && !hasCustomSort) {
        return listJobsRankedByQuery(
            { ...queryParams, q: safeQ },
            { companyId, includeCompanyFromQuery }
        );
    }

    // En cualquier otro caso, usamos la versión simple (actual + regex/text)
    return listJobsSimple(queryParams, { companyId, includeCompanyFromQuery });
}

/* =============================================================================
 *  GET /api/jobs — Listado de empleos con filtros, paginación y ranking
 * =============================================================================
 */
export async function getJobs(req, res) {
    try {
        const result = await listJobs(req.query, {
            includeCompanyFromQuery: true
        });

        res.json(result);

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
 *  GET /api/jobs/company/:companyId — Empleos por empresa (con filtros + ranking)
 * -----------------------------------------------------------------------------
 *  Adicionalmente a los filtros de getJobs, aquí se fuerza company_id.
 * =============================================================================
 */
export async function getJobsByCompany(req, res) {
    try {
        const companyId = req.params.companyId;

        const result = await listJobs(req.query, {
            companyId,
            includeCompanyFromQuery: false // El ID "oficial" es el del path
        });

        res.json(result);

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
 *      countries:           [...],
 *      states:              [...],
 *      cities:              [...],
 *      work_types:          [...],
 *      work_location_types: [...],
 *      pay_periods:         [...]
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
            workLocationTypes,
            payPeriods
        ] = await Promise.all([
            Job.distinct("country"),
            Job.distinct("state"),
            Job.distinct("city"),
            Job.distinct("work_type"),
            Job.distinct("work_location_type"),
            Job.distinct("pay_period")
        ]);

        res.json({
            countries:           countries.filter(Boolean).sort(),
            states:              states.filter(Boolean).sort(),
            cities:              cities.filter(Boolean).sort(),
            work_types:          workTypes.filter(Boolean).sort(),
            work_location_types: workLocationTypes.filter(Boolean).sort(),
            pay_periods:         payPeriods.filter(Boolean).sort()
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
