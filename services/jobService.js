// services/jobService.js

/**
 * ============================================================================
 * jobService.js — Capa de servicio (lógica de negocio) para Empleos (Jobs)
 * ============================================================================
 *
 * Este módulo NO depende de Express (no usa req/res). Expone funciones que
 * reciben entradas “puras” (queryParams, ids, payloads) y operan sobre modelos
 * Mongoose (Job, Company).
 *
 * CONTRATO DE SALIDA (frontend):
 * - Listados devuelven: { meta, data }
 * - meta incluye: { page, limit, total, totalPages }
 * - data contiene Jobs en formato lean + (opcional) objeto company embebido,
 *   donde company.logo es una URL absoluta.
 *
 * AUTORIZACIÓN (actor):
 * - Lecturas (GET): pueden ser públicas (actor opcional).
 * - Escrituras (POST/PUT/DELETE): requieren actor autenticado.
 *   - company: solo puede operar sobre sus propios empleos.
 *   - admin  : puede operar sobre cualquier empleo.
 *
 * ERRORES:
 * - Las funciones de escritura lanzan Error con:
 *   - e.httpStatus (number)   -> sugerido para controllers HTTP
 *   - e.code (string)         -> "unauthorized" | "forbidden" | "bad_request"
 *
 * Dependencias:
 * - Job, Company (Mongoose)
 * - Utils de paginación, parsing, filtros Mongo y transforms (logos/company)
 * ============================================================================
 */

import Job from "../models/Job.js";
import Company from "../models/Company.js";

import { buildPaginationParams } from "../utils/paginationUtils.js";
import { normalizeSearchTerm, escapeRegex } from "../utils/parsingUtils.js";
import {
    applyNumericMinFilter,
    applyNumericMaxFilter,
    addDateRangeFilter
} from "../utils/mongoFilterUtils.js";

import { buildLogoFullPath } from "../utils/assets/logoUtils.js";
import { INTERNAL_JOB_FIELDS } from "../utils/jobs/jobFields.js";
import { attachCompanyAndFormatJobs } from "../utils/jobs/jobTransformUtils.js";

/* =============================================================================
 * Autorización de escrituras
 * =============================================================================
 */

/**
 * Valida que el request provenga de una empresa o un admin.
 *
 * @param {{ type?: string, company_id?: number }|null} actor
 *   Actor autenticado (inyectado por middleware).
 *
 * @returns {{ type: "company"|"admin", company_id?: number }}
 *   Actor validado.
 *
 * @throws {Error} e
 *   - 401 (e.code="unauthorized"): si no hay actor
 *   - 403 (e.code="forbidden")  : si el actor no es company/admin
 */
function requireCompanyOrAdminActor(actor) {
    if (!actor) {
        const e = new Error("Se requiere autenticación.");
        e.code = "unauthorized";
        e.httpStatus = 401;
        throw e;
    }

    if (actor.type !== "company" && actor.type !== "admin") {
        const e = new Error("No autorizado para administrar empleos.");
        e.code = "forbidden";
        e.httpStatus = 403;
        throw e;
    }

    return actor;
}

/**
 * Deriva el filtro de ownership para operaciones sobre un Job.
 *
 * Reglas:
 * - admin  : no restringe por company_id
 * - company: restringe al company_id del actor
 *
 * @param {{ type: "company"|"admin", company_id?: number }} actor
 * @returns {Object}
 *   Objeto filtro parcial para combinar con { job_id } en updates/deletes.
 */
function buildJobOwnershipFilter(actor) {
    if (actor.type === "admin") return {};
    return { company_id: actor.company_id };
}

/**
 * Deriva el company_id efectivo para creación de empleo.
 *
 * Reglas:
 * - company: fuerza company_id desde el actor (ignora payload.company_id)
 * - admin  : requiere payload.company_id válido
 *
 * @param {{ type: "company"|"admin", company_id?: number }} actor
 * @param {Object} payload
 * @returns {number}
 *   company_id efectivo para persistir.
 *
 * @throws {Error} e
 *   - 400 (e.code="bad_request"): si admin no envía company_id válido
 */
function resolveCompanyIdForCreate(actor, payload) {
    if (actor.type === "company") {
        return Number(actor.company_id);
    }

    const cid = Number(payload?.company_id);
    if (!Number.isInteger(cid)) {
        const e = new Error("company_id es requerido para crear empleos como admin.");
        e.code = "bad_request";
        e.httpStatus = 400;
        throw e;
    }
    return cid;
}

/* =============================================================================
 * Filtros base (sin q)
 * =============================================================================
 */

/**
 * Construye filtros MongoDB para consultas de Job (excluye q).
 *
 * queryParams soportados:
 * - country, state, city
 * - work_type, work_location_type, pay_period
 * - company_id (opcional; puede excluirse vía options)
 * - min_salary, max_salary
 * - min_norm_salary, max_norm_salary (normalized_salary)
 * - listed_from, listed_to (rango sobre listed_time)
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @param {boolean} [options.includeCompanyFromQuery=true]
 *   Si false, ignora queryParams.company_id (útil cuando companyId viene “fijo”).
 *
 * @returns {Object}
 *   Filtro MongoDB listo para combinar con búsqueda y sort.
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
 * Ordenamiento y búsqueda simple
 * =============================================================================
 */

/**
 * Construye el sort permitido para listados.
 *
 * Campos soportados:
 * - listed_time, min_salary, max_salary, normalized_salary, createdAt
 *
 * @param {Object} queryParams
 * @returns {Object}
 *   Sort MongoDB (e.g. { listed_time: -1 }).
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
 * Construye filter + sort final integrando `q` mediante $text o regex.
 *
 * Reglas:
 * - Si hay q y NO hay sortBy -> usa $text y sort por textScore + recencia.
 * - Si hay q y SÍ hay sortBy -> usa regex (case-insensitive) y sort normal.
 * - Si no hay q -> solo sort normal.
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
 * Listado con ranking avanzado cuando:
 * - existe `q`
 * - y el cliente NO envía sortBy
 *
 * Salida:
 * - { meta, data }
 * - data contiene documentos de Job (resultado directo del aggregate)
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @param {any}     [options.companyId=null]
 *   Fuerza company_id en el filtro (listado por empresa).
 * @param {boolean} [options.includeCompanyFromQuery=true]
 *   Si false, ignora queryParams.company_id.
 *
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: any[] }>}
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
                $cond: [{ $ifNull: ["$listed_time", false] }, { $toLong: "$listed_time" }, 0]
            }
        }
    };

    const titleTokenScoreExpr = {
        $add: tokens.map((t) => ({
            $cond: [{ $regexMatch: { input: "$titleLower", regex: escapeRegex(t) } }, 1, 0]
        }))
    };

    const descTokenScoreExpr = {
        $add: tokens.map((t) => ({
            $cond: [{ $regexMatch: { input: "$descLower", regex: escapeRegex(t) } }, 1, 0]
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
                $cond: [{ $regexMatch: { input: "$titleLower", regex: phraseRegexEscaped } }, 1, 0]
            },
            phraseInDesc: {
                $cond: [{ $regexMatch: { input: "$descLower", regex: phraseRegexEscaped } }, 1, 0]
            },
            recencyBoost: {
                $let: {
                    vars: {
                        ageDays: {
                            $cond: [
                                { $gt: ["$listedTimeMs", 0] },
                                { $divide: [{ $subtract: [nowMs, "$listedTimeMs"] }, DAY_MS] },
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

    const pipeline = [matchStage, addFieldsBase, addFieldsScores, addFieldsFinalScore, sortStage, facetStage];

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
 * @param {Object} options
 * @param {any}     [options.companyId=null]
 * @param {boolean} [options.includeCompanyFromQuery=true]
 *
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: any[] }>}
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
 * Selecciona automáticamente la estrategia de listado:
 * - ranking avanzado si hay q y no hay sortBy
 * - listado simple en cualquier otro caso
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @param {any}     [options.companyId=null]
 * @param {boolean} [options.includeCompanyFromQuery=true]
 *
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: any[] }>}
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
 * Obtiene un listado general de empleos con filtros, búsqueda, paginación y sort.
 *
 * queryParams principales:
 * - q (string) búsqueda por texto
 * - page (number|string), limit (number|string)
 * - sortBy, sortDir
 * - country, state, city
 * - work_type, work_location_type, pay_period
 * - company_id (opcional)
 * - min_salary, max_salary
 * - min_norm_salary, max_norm_salary
 * - listed_from, listed_to
 * - include_company ("true"|"false") -> por defecto true
 *
 * @param {Object} [queryParams={}]
 *
 * @returns {Promise<{
 *   meta: { page:number, limit:number, total:number, totalPages:number },
 *   data: Array<Object>
 * }>}
 * - data: Jobs (lean) con `company` embebida si include_company != "false".
 */
export async function getJobsService(queryParams = {}) {
    const result = await listJobs(queryParams, { includeCompanyFromQuery: true });

    const includeCompany = String(queryParams.include_company ?? "true").toLowerCase() !== "false";

    if (!includeCompany) {
        return { meta: result.meta, data: result.data };
    }

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data, {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return { meta: result.meta, data: jobsWithCompany };
}

/**
 * Obtiene un listado de empleos restringido a una empresa (company_id fijo).
 *
 * @param {any} companyId
 *   Identificador de empresa (company_id).
 * @param {Object} [queryParams={}]
 *   Mismos queryParams que getJobsService, excepto que company_id del query
 *   se ignora (includeCompanyFromQuery=false).
 *
 * @returns {Promise<{
 *   meta: { page:number, limit:number, total:number, totalPages:number },
 *   data: Array<Object>
 * }>}
 */
export async function getJobsByCompanyService(companyId, queryParams = {}) {
    const result = await listJobs(queryParams, {
        companyId,
        includeCompanyFromQuery: false
    });

    const includeCompany = String(queryParams.include_company ?? "true").toLowerCase() !== "false";

    if (!includeCompany) {
        return { meta: result.meta, data: result.data };
    }

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data, {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return { meta: result.meta, data: jobsWithCompany };
}

/**
 * Recomendaciones de títulos de empleo basadas en texto parcial.
 *
 * @param {string} q
 *   Texto parcial a buscar dentro de Job.title.
 * @param {Object} [options={}]
 * @param {number} [options.limit=10]
 *   Máximo de títulos recomendados.
 *
 * @returns {Promise<string[]>}
 *   Lista de títulos únicos ordenados por relevancia y frecuencia.
 */
export async function getJobTitleRecommendationsService(q, { limit = 10 } = {}) {
    const safeQ = normalizeSearchTerm(q);
    if (!safeQ) {
        return [];
    }

    const regex = new RegExp(escapeRegex(safeQ), "i");

    const pipeline = [
        { $match: { title: regex } },
        { $group: { _id: "$title", count: { $sum: 1 } } },
        { $addFields: { titleLower: { $toLower: "$_id" } } },
        {
            $addFields: {
                relevance: {
                    $cond: [{ $regexMatch: { input: "$titleLower", regex: `^${escapeRegex(safeQ)}` } }, 2, 1]
                }
            }
        },
        { $sort: { relevance: -1, count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, title: "$_id" } }
    ];

    const results = await Job.aggregate(pipeline);
    return results.map((r) => r.title);
}

/**
 * Obtiene un Job por su identificador público (job_id).
 *
 * @param {string|number} id
 *   job_id incremental.
 * @param {Object} [options={}]
 * @param {boolean} [options.includeCompany=true]
 *   Si true, adjunta el objeto company con logo absoluto.
 *
 * @returns {Promise<Object|null>}
 *   - Job formateado (con company si aplica) o null si no existe/ID inválido.
 */
export async function getJobByIdService(id, { includeCompany = true } = {}) {
    const jobId = Number(id);
    if (!Number.isInteger(jobId)) return null;

    const job = await Job.findOne({ job_id: jobId }).lean();
    if (!job) return null;

    if (!includeCompany) {
        return job;
    }

    const [formatted] = await attachCompanyAndFormatJobs([job], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted || null;
}

/**
 * Obtiene opciones para construir filtros en UI.
 *
 * Cache:
 * - Se cachea en memoria del proceso (JOB_FILTER_CACHE) después de la 1ra llamada.
 *
 * @returns {Promise<{
 *   work_types: string[],
 *   work_location_types: string[],
 *   pay_periods: string[]
 * }>}
 */
let JOB_FILTER_CACHE = null;
export async function getJobFilterOptionsService() {
    if (JOB_FILTER_CACHE) {
        return JOB_FILTER_CACHE;
    }

    const [workTypes, workLocationTypes, payPeriods] = await Promise.all([
        Job.distinct("work_type"),
        Job.distinct("work_location_type"),
        Job.distinct("pay_period")
    ]);

    JOB_FILTER_CACHE = {
        work_types: workTypes.filter(Boolean).sort(),
        work_location_types: workLocationTypes.filter(Boolean).sort(),
        pay_periods: payPeriods.filter(Boolean).sort()
    };

    return JOB_FILTER_CACHE;
}

/**
 * Crea un Job.
 *
 * Requiere actor:
 * - company: crea bajo actor.company_id (payload.company_id se ignora)
 * - admin  : puede crear para cualquier empresa, pero payload.company_id es requerido
 *
 * @param {{ type: "company"|"admin", company_id?: number }|null} actor
 * @param {Object} payload
 *   Payload del Job (campos del modelo). Para admin, debe incluir company_id.
 *
 * @returns {Promise<Object>}
 *   Job creado y formateado (incluye company con logo absoluto).
 *
 * @throws {Error} e
 *   - 401 unauthorized
 *   - 403 forbidden
 *   - 400 bad_request (admin sin company_id válido)
 */
export async function createJobService(actor, payload) {
    const a = requireCompanyOrAdminActor(actor);

    const effectiveCompanyId = resolveCompanyIdForCreate(a, payload);

    const jobPayload = {
        ...payload,
        company_id: effectiveCompanyId
    };

    const job = await Job.create(jobPayload);

    const [formatted] = await attachCompanyAndFormatJobs([job], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted;
}

/**
 * =============================================================================
 * updateJobService
 * =============================================================================
 *
 * Actualiza una oferta de empleo identificada por su `job_id` incremental.
 *
 * Reglas de autorización:
 * - actor.type === "admin"
 *     Puede actualizar cualquier empleo.
 * - actor.type === "company"
 *     Solo puede actualizar empleos cuyo `company_id` coincida con el del actor.
 *
 * Reglas de integridad:
 * - El empleo debe existir.
 * - El actor debe estar autenticado y autorizado.
 * - Los campos derivados (ej. normalized_salary) se recalculan automáticamente
 *   en el modelo al persistir los cambios.
 *
 * Convenciones de error:
 * - 401 Unauthorized
 *     Actor ausente o inválido.
 * - 404 Not Found
 *     El empleo no existe.
 * - 403 Forbidden
 *     El empleo existe pero el actor no tiene permisos.
 *
 * @param {{ type: "company"|"admin", company_id?: number }} actor
 *   Actor autenticado que ejecuta la operación.
 *
 * @param {string|number} id
 *   Identificador incremental `job_id`.
 *
 * @param {Object} payload
 *   Campos del empleo a actualizar.
 *   Solo se procesan campos válidos definidos en el modelo.
 *
 * @returns {Promise<Object>}
 *   Empleo actualizado, con empresa adjunta y campos internos filtrados.
 *
 * @throws {Error}
 *   Error con propiedad `status` para ser traducido a HTTP por el controller.
 * =============================================================================
 */
export async function updateJobService(actor, id, payload) {
    /* =========================================================================
     * 1. Validación de actor
     * ========================================================================= */
    const a = requireCompanyOrAdminActor(actor);

    /* =========================================================================
     * 2. Validación del identificador
     * ========================================================================= */
    const jobId = Number(id);
    if (!Number.isInteger(jobId)) {
        const e = new Error("job_id inválido: debe ser un entero.");
        e.code = "bad_request";
        e.httpStatus = 400;
        throw e;
    }

    /* =========================================================================
     * 3. Verificación de existencia
     * ========================================================================= */
    const job = await Job.findOne({ job_id: jobId });
    if (!job) {
        const e = new Error(`Job no encontrado (job_id=${jobId}).`);
        e.code = "not_found";
        e.httpStatus = 404;
        throw e;
    }

    /* =========================================================================
     * 4. Autorización
     * ========================================================================= */
    if (a.type === "company" && job.company_id !== a.company_id) {
        const e = new Error(
            `Prohibido: la empresa ${a.company_id} no puede modificar el job ${jobId}.`
        );
        e.code = "forbidden";
        e.httpStatus = 403;
        throw e;
    }

    /* =========================================================================
     * 5. Actualización
     * ========================================================================= */
    Object.assign(job, payload);
    await job.save();

    /* =========================================================================
     * 6. Formateo de salida
     * ========================================================================= */
    const [formatted] = await attachCompanyAndFormatJobs([job], {
        CompanyModel: Company,
        buildLogoFullPath,
        internalJobFields: INTERNAL_JOB_FIELDS
    });

    return formatted;
}



/**
 * Elimina un Job por job_id.
 *
 * Requiere actor:
 * - company: solo puede eliminar empleos de su company_id
 * - admin  : puede eliminar cualquier empleo
 *
 * @param {{ type: "company"|"admin", company_id?: number }|null} actor
 * @param {string|number} id
 *   job_id incremental.
 *
 * @returns {Promise<boolean>}
 *   true si eliminó, false si job_id inválido o no encontrado/no autorizado.
 *
 * @throws {Error} e
 *   - 401 unauthorized
 *   - 403 forbidden
 */
export async function deleteJobService(actor, id) {
    const a = requireCompanyOrAdminActor(actor);

    const jobId = Number(id);
    if (!Number.isInteger(jobId)) return false;

    const ownership = buildJobOwnershipFilter(a);

    const deleted = await Job.findOneAndDelete({ job_id: jobId, ...ownership });
    return Boolean(deleted);
}
