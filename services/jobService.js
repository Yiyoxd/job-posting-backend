// services/jobService.js

/**
 * ============================================================================
 * jobService.js — Capa de servicio (lógica de negocio) para Empleos (Jobs)
 * ============================================================================
 *
 * Este módulo implementa lógica de negocio para empleos sin depender de Express
 * (no usa req/res). Expone funciones que reciben entradas “puras” (queryParams,
 * ids, payloads) y operan sobre modelos Mongoose (Job, Company).
 *
 * El formato de salida (meta + data; y en cada job un objeto `company` con su
 * `logo` como URL absoluta) forma parte del contrato consumido por el frontend.
 * ============================================================================
 */

import Job from "../models/Job.js";
import Company from "../models/Company.js";

import { buildPaginationParams } from "../utils/paginationUtils.js";
import { normalizeSearchTerm, escapeRegex } from "../utils/parsingUtils.js";
import { applyNumericMinFilter, applyNumericMaxFilter, addDateRangeFilter } from "../utils/mongoFilterUtils.js";

import { buildLogoFullPath } from "../utils/assets/logoUtils.js";
import { INTERNAL_JOB_FIELDS } from "../utils/jobs/jobFields.js";
import { attachCompanyAndFormatJobs } from "../utils/jobs/jobTransformUtils.js";

/* =============================================================================
 * Filtros base (sin q)
 * =============================================================================
 */

/**
 * Construye el objeto de filtros MongoDB para consultas de Job, excluyendo `q`
 * (la búsqueda se integra por separado).
 *
 * @param {Object} queryParams
 * @param {{ includeCompanyFromQuery?: boolean }} options
 * @returns {Object}
 */
function buildBaseJobFilters(queryParams = {}, { includeCompanyFromQuery = true } = {}) {
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
        listed_to
    } = queryParams;

    const filter = {};

    if (country) filter.country = country;
    if (state) filter.state = state;
    if (city) filter.city = city;

    if (work_type) filter.work_type = work_type;

    if (work_location_type) {
        const upper = String(work_location_type).trim().toUpperCase();
        if (upper) filter.work_location_type = upper;
    }

    if (pay_period) filter.pay_period = pay_period;

    if (includeCompanyFromQuery && company_id) {
        filter.company_id = company_id;
    }

    applyNumericMinFilter(filter, "min_salary", min_salary);
    applyNumericMaxFilter(filter, "max_salary", max_salary);

    applyNumericMinFilter(filter, "normalized_salary", min_norm_salary);
    applyNumericMaxFilter(filter, "normalized_salary", max_norm_salary);

    addDateRangeFilter(filter, "listed_time", listed_from, listed_to);

    return filter;
}

/* =============================================================================
 * Ordenamiento y búsqueda simple (sin ranking avanzado)
 * =============================================================================
 */

/**
 * Construye el objeto de ordenamiento permitido.
 *
 * @param {Object} queryParams
 * @returns {Object}
 */
function buildJobSort(queryParams = {}) {
    const { sortBy, sortDir } = queryParams;

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
 * Construye filter + sort final integrando `q` mediante $text o regex según el caso.
 *
 * Reglas:
 * - Si hay q y NO hay sortBy -> usa $text.
 * - Si hay q y SÍ hay sortBy -> usa regex case-insensitive.
 * - Si no hay q -> solo sort.
 *
 * @param {Object} queryParams
 * @param {Object} baseFilters
 * @returns {{ filter: Object, sort: Object }}
 */
function buildJobQueryAndSort(queryParams = {}, baseFilters = {}) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    const filter = { ...baseFilters };
    let sort;

    if (safeQ && !hasCustomSort) {
        filter.$text = { $search: safeQ };
        sort = { score: { $meta: "textScore" }, listed_time: -1 };
    } else {
        if (safeQ) {
            const regex = new RegExp(escapeRegex(safeQ), "i");
            filter.$or = [{ title: regex }, { description: regex }];
        }
        sort = buildJobSort(queryParams);
    }

    return { filter, sort };
}

/* =============================================================================
 * Ranking avanzado (cuando hay q y no hay sortBy)
 * =============================================================================
 */

/**
 * Aplica ranking avanzado cuando:
 * - existe `q`
 * - y el cliente no envía sortBy
 *
 * @param {Object} queryParams
 * @param {{ companyId?: any, includeCompanyFromQuery?: boolean }} options
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listJobsRankedByQuery(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
    const { page, limit, skip } = buildPaginationParams(queryParams);

    const baseFilters = buildBaseJobFilters(queryParams, { includeCompanyFromQuery });
    if (companyId) baseFilters.company_id = companyId;

    const safeQ = normalizeSearchTerm(queryParams.q);
    if (!safeQ) {
        return listJobsSimple(queryParams, { companyId, includeCompanyFromQuery });
    }

    const tokens = safeQ.split(" ").filter(Boolean);
    const nowMs = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;

    const matchStage = {
        $match: {
            ...baseFilters,
            $text: { $search: safeQ }
        }
    };

    const addFieldsBase = {
        $addFields: {
            textScore: { $meta: "textScore" },
            titleLower: { $toLower: { $ifNull: ["$title", ""] } },
            descLower: { $toLower: { $ifNull: ["$description", ""] } },
            listedTimeMs: {
                $cond: [
                    { $ifNull: ["$listed_time", false] },
                    { $toLong: "$listed_time" },
                    0
                ]
            }
        }
    };

    const titleTokenScoreExpr = {
        $add: tokens.map((t) => ({
            $cond: [
                { $regexMatch: { input: "$titleLower", regex: escapeRegex(t) } },
                1,
                0
            ]
        }))
    };

    const descTokenScoreExpr = {
        $add: tokens.map((t) => ({
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
                $and: tokens.map((t) => ({
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
            descTermScore: descTokenScoreExpr,
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
                                365
                            ]
                        }
                    },
                    in: { $max: [0, { $subtract: [60, "$$ageDays"] }] }
                }
            }
        }
    };

    const addFieldsFinalScore = {
        $addFields: {
            finalScore: {
                $add: [
                    { $multiply: ["$textScore", 5] },
                    { $multiply: ["$titleTermScore", 4] },
                    { $multiply: ["$descTermScore", 1] },
                    { $multiply: ["$allTermsInTitle", 15] },
                    { $multiply: ["$phraseInTitle", 25] },
                    { $multiply: ["$phraseInDesc", 8] },
                    "$recencyBoost"
                ]
            }
        }
    };

    const sortStage = { $sort: { finalScore: -1, listed_time: -1 } };

    const facetStage = {
        $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "count" }]
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

    const jobs = facet.data || [];
    const total = (facet.totalCount[0] && facet.totalCount[0].count) || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: { page, limit, total, totalPages },
        data: jobs
    };
}

/* =============================================================================
 * Listado simple (cuando no aplica ranking avanzado)
 * =============================================================================
 */

/**
 * Listado simple con filtros, búsqueda (regex o $text), paginación y ordenamiento.
 *
 * @param {Object} queryParams
 * @param {{ companyId?: any, includeCompanyFromQuery?: boolean }} options
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listJobsSimple(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
    const { page, limit, skip } = buildPaginationParams(queryParams);

    const baseFilters = buildBaseJobFilters(queryParams, { includeCompanyFromQuery });
    if (companyId) baseFilters.company_id = companyId;

    const { filter, sort } = buildJobQueryAndSort(queryParams, baseFilters);

    const [total, jobs] = await Promise.all([
        Job.countDocuments(filter),
        Job.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: { page, limit, total, totalPages },
        data: jobs
    };
}

/* =============================================================================
 * Selector de estrategia de listado
 * =============================================================================
 */

/**
 * Selecciona automáticamente:
 * - ranking avanzado si hay q y no hay sortBy
 * - listado simple en cualquier otro caso
 *
 * @param {Object} queryParams
 * @param {{ companyId?: any, includeCompanyFromQuery?: boolean }} options
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listJobs(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    if (safeQ && !hasCustomSort) {
        return listJobsRankedByQuery({ ...queryParams, q: safeQ }, { companyId, includeCompanyFromQuery });
    }

    return listJobsSimple(queryParams, { companyId, includeCompanyFromQuery });
}

/* =============================================================================
 * Servicios expuestos (consumidos por controllers u otros procesos)
 * =============================================================================
 */

/**
 * Servicio: listado general de empleos.
 * Contrato de salida: { meta, data }, y cada job incluye `company` con `logo` absoluto.
 *
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
export async function getJobsService(queryParams = {}) {
    const result = await listJobs(queryParams, { includeCompanyFromQuery: true });

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data, {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return { meta: result.meta, data: jobsWithCompany };
}

/**
 * Servicio: listado de empleos filtrado por empresa (companyId fijo).
 *
 * @param {any} companyId
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
export async function getJobsByCompanyService(companyId, queryParams = {}) {
    const result = await listJobs(queryParams, {
        companyId,
        includeCompanyFromQuery: false
    });

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data, {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return { meta: result.meta, data: jobsWithCompany };
}

/**
 * Servicio: obtener un job por ID (Mongo _id).
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getJobByIdService(id) {
    const job = await Job.findById(id);
    if (!job) return null;

    const [formatted] = await attachCompanyAndFormatJobs([job], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted || null;
}

/**
 * Servicio: opciones de filtros para UI (distincts).
 *
 * @returns {Promise<{
 *   countries: string[],
 *   states: string[],
 *   cities: string[],
 *   work_types: string[],
 *   work_location_types: string[],
 *   pay_periods: string[]
 * }>}
 */
export async function getJobFilterOptionsService() {
    const [countries, states, cities, workTypes, workLocationTypes, payPeriods] = await Promise.all([
        Job.distinct("country"),
        Job.distinct("state"),
        Job.distinct("city"),
        Job.distinct("work_type"),
        Job.distinct("work_location_type"),
        Job.distinct("pay_period")
    ]);

    return {
        countries: countries.filter(Boolean).sort(),
        states: states.filter(Boolean).sort(),
        cities: cities.filter(Boolean).sort(),
        work_types: workTypes.filter(Boolean).sort(),
        work_location_types: workLocationTypes.filter(Boolean).sort(),
        pay_periods: payPeriods.filter(Boolean).sort()
    };
}

/**
 * Servicio: crear un job.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createJobService(payload) {
    const job = await Job.create(payload);

    const [formatted] = await attachCompanyAndFormatJobs([job], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted;
}

/**
 * Servicio: actualizar un job.
 *
 * @param {string} id
 * @param {Object} payload
 * @returns {Promise<Object|null>}
 */
export async function updateJobService(id, payload) {
    const updated = await Job.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return null;

    const [formatted] = await attachCompanyAndFormatJobs([updated], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted;
}

/**
 * Servicio: eliminar un job.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteJobService(id) {
    const deleted = await Job.findByIdAndDelete(id);
    return Boolean(deleted);
}
