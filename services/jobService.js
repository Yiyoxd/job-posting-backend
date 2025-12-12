/**
 * ============================================================================
 *  jobService.js — LÓGICA DE NEGOCIO DE EMPLEOS (CAPA DE SERVICIO)
 * ============================================================================
 *
 * Este archivo NO conoce Express ni req/res.
 * Solo expone funciones que trabajan con:
 *   - Parámetros "puros" (queryParams, id, payload)
 *   - Modelos Mongoose (Job, Company)
 *   - Objetos JavaScript simples
 *
 * Es lo que debería usarse desde:
 *   - Controladores HTTP (Express)
 *   - Jobs/cron internos
 *   - Scripts que necesitan lógica de filtrado y ranking
 *
 * NOTA: La forma en que se arman los objetos devueltos (meta + data, jobs con
 * company y logo) ES parte del contrato que consume el frontend.
 * ============================================================================
 */

import Job from "../models/Job.js";
import Company from "../models/Company.js";

/* =============================================================================
 *  CONSTANTES GLOBALES (COMPARTIDAS ENTRE SERVICE Y RESPUESTAS)
 * =============================================================================
 */

// URL base del backend (para construir rutas absolutas de assets, como logos)
// Ejemplo en desarrollo:
//   API_BASE_URL = "http://localhost:8000/api"
//   ASSET_BASE_URL = "http://localhost:8000"
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Eliminamos el sufijo `/api` para poder servir imágenes estáticas
const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// Directorio público donde Express sirve los logos:
//   /company_logos  → expone data/company_logos
const LOGO_PUBLIC_PREFIX = "/company_logos";

// Subcarpeta real donde quedaron los logos procesados:
//   data/company_logos/processed
const LOGO_PROCESSED_DIR = "processed";

// Path relativo que el navegador debe pedir para acceder al logo:
//   /company_logos/processed/<company_id>.png
const LOGO_RELATIVE_DIR = `${LOGO_PUBLIC_PREFIX}/${LOGO_PROCESSED_DIR}`;

// Campos que NO deben exponerse al frontend (internos de Mongo o del ranking)
const INTERNAL_JOB_FIELDS = [
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    // Campos internos del ranking avanzado
    "textScore",
    "titleLower",
    "descLower",
    "listedTimeMs",
    "titleTermScore",
    "descTermScore",
    "allTermsInTitle",
    "phraseInTitle",
    "phraseInDesc",
    "recencyBoost",
    "finalScore"
];

/* =============================================================================
 *  HELPERS GENÉRICOS (solo lógica, sin nada de HTTP)
 * =============================================================================
 */

/**
 * Parsea un número desde query string.
 * @param {any} value - Valor recibido (por ejemplo, req.query.min_salary).
 * @returns {number|null} Número parseado o null si no es válido.
 */
function parseNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * Parsea una fecha YYYY-MM-DD (o ISO). Devuelve null si no es válida.
 * @param {string} value - Fecha como string.
 * @returns {Date|null}
 */
function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza el término de búsqueda de texto:
 *   - recorta espacios
 *   - colapsa espacios múltiples
 *   - pone todo en minúsculas
 *
 * @param {string} q - Texto crudo de búsqueda (req.query.q).
 * @returns {string|null} Texto normalizado o null si queda vacío.
 */
function normalizeSearchTerm(q) {
    if (q === undefined || q === null) return null;
    const s = String(q)
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    return s.length ? s : null;
}

/**
 * Escapa caracteres especiales para usarlos en una expresión regular.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Aplica un filtro numérico mínimo (campo >= valor).
 * @param {Object} filter - Objeto de filtros de Mongo.
 * @param {string} fieldName - Nombre del campo (ej. "min_salary").
 * @param {any} rawValue - Valor crudo de la query (ej. req.query.min_salary).
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
 * @param {Object} filter
 * @param {string} fieldName
 * @param {any} rawValue
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
 * @param {Object} filter - Objeto de filtros de Mongo.
 * @param {string} fieldName - Campo de fecha (ej. "listed_time").
 * @param {string} fromRaw - Fecha mínima (YYYY-MM-DD).
 * @param {string} toRaw - Fecha máxima (YYYY-MM-DD).
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
 * Construye los parámetros de paginación a partir de query.
 *
 * @param {Object} queryParams - Por lo general req.query.
 * @returns {{ page: number, limit: number, skip: number }}
 */
function buildPaginationParams(queryParams = {}) {
    const page  = Math.max(parseInt(queryParams.page || "1", 10), 1);
    const limit = Math.max(parseInt(queryParams.limit || "20", 10), 1);
    const skip  = (page - 1) * limit;

    return { page, limit, skip };
}

/* =============================================================================
 *  COMPANY + LOGO (formato unificado para el frontend)
 * =============================================================================
 */

/**
 * buildLogoFullPath
 * ------------------
 * Construye la URL COMPLETA del logo a partir de company_id.
 *
 * Esta función es importante para el frontend, porque define
 * CÓMO debe pedir la imagen del logo.
 *
 * Ejemplo (dev):
 *   API_BASE_URL   = "http://localhost:8000/api"
 *   ASSET_BASE_URL = "http://localhost:8000"
 *
 *   company_id = 268
 *
 *   → "http://localhost:8000/company_logos/processed/268.png"
 *
 * @param {number|string|null} companyId - ID numérico/secuencial de la empresa.
 * @returns {string|null} URL absoluta del logo, o null si no hay companyId.
 */
export function buildLogoFullPath(companyId) {
    if (!companyId) return null;
    return `${ASSET_BASE_URL}${LOGO_RELATIVE_DIR}/${companyId}.png`;
}

/**
 * Elimina campos internos de un job antes de exponerlo al frontend.
 *
 * @param {Object} job - Objeto plain de Mongo/Mongoose.
 * @returns {Object} job sin campos internos.
 */
function cleanJobObject(job) {
    const clone = { ...job };
    for (const key of INTERNAL_JOB_FIELDS) {
        delete clone[key];
    }
    return clone;
}

/**
 * attachCompanyAndFormatJobs
 * --------------------------
 * Recibe una lista de jobs (docs de Mongoose o plain objects) y:
 *
 * 1. Los convierte a plain objects.
 * 2. Elimina campos internos.
 * 3. Adjunta SIEMPRE un objeto `company` con la forma:
 *
 *    company: {
 *      name,
 *      company_id,
 *      description,
 *      country,
 *      state,
 *      city,
 *      address,
 *      company_size_min,
 *      company_size_max,
 *      logo  // FULL URL: "<ASSET_BASE_URL>/company_logos/processed/<id>.png"
 *    }
 *
 *   - Si la empresa existe en la colección Company:
 *       → se llenan todos los campos con los de Company.
 *
 *   - Si NO existe la empresa en Company pero el job tiene company_id:
 *       → se usa un "fallback" que rellena country/state/city desde el job
 *         y deja el resto en null, pero SIEMPRE arma el logo con company_id.
 *
 *   - Si el job ni siquiera tiene company_id:
 *       → `company` se deja en null.
 *
 * Este formato es el que consumirá el frontend en TODOS los endpoints
 * de empleos para mostrar datos de la empresa junto con la vacante.
 *
 * @param {Array} rawJobs - Lista de documentos Job (o plain objects).
 * @returns {Promise<Array>} Lista de jobs formateados con `company`.
 */
async function attachCompanyAndFormatJobs(rawJobs = []) {
    if (!Array.isArray(rawJobs) || rawJobs.length === 0) return [];

    const jobs = rawJobs
        .map(job => {
            if (!job) return null;
            let plain;
            if (typeof job.toObject === "function") {
                plain = job.toObject();
            } else if (typeof job.toJSON === "function") {
                plain = job.toJSON();
            } else {
                plain = { ...job };
            }
            return cleanJobObject(plain);
        })
        .filter(Boolean);

    const companyIds = [
        ...new Set(
            jobs
                .map(j => j.company_id)
                .filter(id => id !== undefined && id !== null)
        )
    ];

    const companyMap = new Map();

    if (companyIds.length > 0) {
        const companies = await Company.find({
            company_id: { $in: companyIds }
        }).lean();

        for (const c of companies) {
            if (!c) continue;
            const { _id, __v, createdAt, updatedAt, ...rest } = c;

            const logo = buildLogoFullPath(rest.company_id);

            companyMap.set(rest.company_id, {
                name: rest.name ?? null,
                company_id: rest.company_id ?? null,
                description: rest.description ?? null,
                country: rest.country ?? null,
                state: rest.state ?? null,
                city: rest.city ?? null,
                address: rest.address ?? null,
                company_size_min: rest.company_size_min ?? null,
                company_size_max: rest.company_size_max ?? null,
                logo
            });
        }
    }

    const result = jobs.map(job => {
        const companyId = job.company_id;
        const companyFromDb =
            companyId !== undefined && companyId !== null
                ? companyMap.get(companyId)
                : null;

        let company = null;

        if (companyFromDb) {
            company = { ...companyFromDb };
        } else if (companyId !== undefined && companyId !== null) {
            // Empresa no encontrada en la colección → fallback coherente
            company = {
                name: null,
                company_id: companyId,
                description: null,
                country: job.country ?? null,
                state: job.state ?? null,
                city: job.city ?? null,
                address: null,
                company_size_min: null,
                company_size_max: null,
                logo: buildLogoFullPath(companyId)
            };
        } else {
            // Ni siquiera hay company_id → company totalmente null
            company = null;
        }

        return {
            ...job,
            company
        };
    });

    return result;
}

/* =============================================================================
 *  FILTROS BASE (SIN q)
 * =============================================================================
 */

/**
 * buildBaseJobFilters
 * -------------------
 * Construye el objeto de filtros MongoDB para Job.find() / aggregate,
 * usando TODOS los parámetros excepto "q" (que se maneja aparte).
 *
 * @param {Object} queryParams - Normalmente req.query.
 * @param {Object} options
 *   - includeCompanyFromQuery: si true, aplica company_id desde la query.
 *
 * Campos de entrada típicos:
 *   - country, state, city
 *   - work_type
 *   - work_location_type
 *   - pay_period
 *   - company_id (solo /api/jobs; en /api/jobs/company/:id se ignora)
 *   - min_salary, max_salary
 *   - min_norm_salary, max_norm_salary
 *   - listed_from, listed_to
 *
 * @returns {Object} filter - Objeto de filtros para Mongo.
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

    // Ubicación
    if (country) filter.country = country;
    if (state)   filter.state   = state;
    if (city)    filter.city    = city;

    // Tipo de trabajo (FULL_TIME, CONTRACT, etc.)
    if (work_type) filter.work_type = work_type;

    // Modalidad (ONSITE, HYBRID, REMOTE)
    if (work_location_type) {
        const upper = String(work_location_type).trim().toUpperCase();
        if (upper) {
            filter.work_location_type = upper;
        }
    }

    // Período de pago (HOURLY, YEARLY, etc.)
    if (pay_period) filter.pay_period = pay_period;

    // Filtro por empresa (solo en /api/jobs)
    if (includeCompanyFromQuery && company_id) {
        filter.company_id = company_id;
    }

    // Filtros de salario "crudos"
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
 *  ORDENAMIENTO Y BÚSQUEDA SIMPLE (SIN RANKING AVANZADO)
 * =============================================================================
 */

/**
 * buildJobSort
 * ------------
 * Construye el objeto de ordenamiento para Job.find() / aggregate.
 *
 * Entradas:
 *   - sortBy  (listed_time | min_salary | max_salary | normalized_salary | createdAt)
 *   - sortDir (asc | desc)
 *
 * @param {Object} queryParams
 * @returns {Object} sort
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
 * buildJobQueryAndSort
 * --------------------
 * Construye:
 *   - filter → Filtros finales con q incluida (via $text o regex).
 *   - sort   → Ordenamiento final.
 *
 * Casos:
 *   1) Si hay q y NO hay sortBy:
 *        - Usa $text (índice de texto).
 *   2) Si hay q y SÍ hay sortBy:
 *        - Usa regex case-insensitive en title/description.
 *   3) Si NO hay q:
 *        - Solo aplica sortBy/sortDir o listed_time desc por defecto.
 *
 * @param {Object} queryParams
 * @param {Object} baseFilters - Filtros construidos sin q.
 * @returns {{ filter: Object, sort: Object }}
 */
function buildJobQueryAndSort(queryParams = {}, baseFilters = {}) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    const filter = { ...baseFilters };
    let sort;

    if (safeQ && !hasCustomSort) {
        // MODO FULL-TEXT SIMPLE (entrada al ranking avanzado; aquí es fallback)
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
 *  RANKING AVANZADO (CUANDO HAY q Y NO HAY sortBy)
 * =============================================================================
 */

/**
 * listJobsRankedByQuery
 * ---------------------
 * Aplica el RANKING AVANZADO usando aggregate cuando:
 *   - Hay q (texto de búsqueda)
 *   - Y el cliente NO envió sortBy
 *
 * Cosas que tiene en cuenta:
 *   - $text con índice de texto (title/description)
 *   - Cuántas palabras de q aparecen en título/descripción
 *   - Si TODAS las palabras aparecen en el título
 *   - Si la frase completa aparece en título / descripción
 *   - Pequeño boost por recencia (listed_time)
 *
 * Devuelve:
 *   {
 *     meta: { page, limit, total, totalPages },
 *     data: [ ...jobs ]
 *   }
 *
 * Esta función NO adjunta todavía la info de company ni formatea el job.
 *
 * @param {Object} queryParams - Normalmente req.query.
 * @param {Object} options
 *   - companyId: para filtrar por una empresa fija (endpoint company/:id)
 *   - includeCompanyFromQuery: si aplica company_id del query en /api/jobs
 */
async function listJobsRankedByQuery(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
    const { page, limit, skip } = buildPaginationParams(queryParams);
    const baseFilters = buildBaseJobFilters(queryParams, {
        includeCompanyFromQuery
    });

    if (companyId) {
        baseFilters.company_id = companyId;
    }

    const safeQ = normalizeSearchTerm(queryParams.q);
    if (!safeQ) {
        // Seguridad: si algo falla con q, se cae al modo simple
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
                                365
                            ]
                        }
                    },
                    in: {
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

    const jobs = facet.data || [];
    const total = (facet.totalCount[0] && facet.totalCount[0].count) || 0;
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
 *  LISTADO SIMPLE (CUANDO NO APLICA RANKING AVANZADO)
 * =============================================================================
 */

/**
 * listJobsSimple
 * --------------
 * Listado de empleos sin ranking avanzado. Aplica:
 *   - Filtros base (ubicación, salario, fechas, etc.).
 *   - Búsqueda simple (regex o $text, según parámetros).
 *   - Paginación.
 *   - Ordenamiento sortBy/sortDir o listed_time desc por defecto.
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listJobsSimple(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
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
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean()
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
 *  CORE GENERAL DE LISTADOS (DECIDE ENTRE SIMPLE Y RANKING AVANZADO)
 * =============================================================================
 */

/**
 * listJobs
 * --------
 * Decide automáticamente si usar:
 *   - Ranking avanzado (aggregate + finalScore)
 *   - Listado simple (find + sort)
 *
 * Reglas:
 *   - Si hay q y NO hay sortBy → ranking avanzado.
 *   - En cualquier otro caso → listado simple.
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listJobs(
    queryParams = {},
    { companyId = null, includeCompanyFromQuery = true } = {}
) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    if (safeQ && !hasCustomSort) {
        return listJobsRankedByQuery(
            { ...queryParams, q: safeQ },
            { companyId, includeCompanyFromQuery }
        );
    }

    return listJobsSimple(queryParams, { companyId, includeCompanyFromQuery });
}

/* =============================================================================
 *  FUNCIONES DE SERVICIO EXPUESTAS (USADAS POR EL CONTROLLER)
 * =============================================================================
 */

/**
 * getJobsService
 * --------------
 * Lógica completa para:
 *   GET /api/jobs
 *
 * Entradas:
 *   - queryParams: objeto estilo req.query con filtros, paginación, ordenamiento.
 *
 * Salida:
 *   {
 *     meta: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number
 *     },
 *     data: [
 *       {
 *         // Campos del Job (id, title, description, salary, etc.)
 *         company: {
 *           name,
 *           company_id,
 *           description,
 *           country,
 *           state,
 *           city,
 *           address,
 *           company_size_min,
 *           company_size_max,
 *           logo // URL absoluta del logo
 *         }
 *       },
 *       ...
 *     ]
 *   }
 *
 * Esta es la forma EXACTA que verá el frontend en la respuesta HTTP.
 */
export async function getJobsService(queryParams = {}) {
    const result = await listJobs(queryParams, {
        includeCompanyFromQuery: true
    });

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data);

    return {
        meta: result.meta,
        data: jobsWithCompany
    };
}

/**
 * getJobsByCompanyService
 * -----------------------
 * Lógica para:
 *   GET /api/jobs/company/:companyId
 *
 * Además de todos los filtros, forza company_id a ser el de :companyId.
 */
export async function getJobsByCompanyService(companyId, queryParams = {}) {
    const result = await listJobs(queryParams, {
        companyId,
        includeCompanyFromQuery: false
    });

    const jobsWithCompany = await attachCompanyAndFormatJobs(result.data);

    return {
        meta: result.meta,
        data: jobsWithCompany
    };
}

/**
 * getJobByIdService
 * -----------------
 * Lógica para:
 *   GET /api/jobs/:id
 *
 * @param {string} id - ID de Mongo del documento Job.
 * @returns {Promise<Object|null>} Job formateado con company o null si no existe.
 */
export async function getJobByIdService(id) {
    const job = await Job.findById(id);

    if (!job) return null;

    const [formatted] = await attachCompanyAndFormatJobs([job]);
    return formatted;
}

/**
 * getJobFilterOptionsService
 * --------------------------
 * Lógica para:
 *   GET /api/jobs/filters/options
 *
 * Devuelve los distincts para construir combos/filtros en el frontend:
 *   - countries, states, cities
 *   - work_types
 *   - work_location_types
 *   - pay_periods
 */
export async function getJobFilterOptionsService() {
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

    return {
        countries:           countries.filter(Boolean).sort(),
        states:              states.filter(Boolean).sort(),
        cities:              cities.filter(Boolean).sort(),
        work_types:          workTypes.filter(Boolean).sort(),
        work_location_types: workLocationTypes.filter(Boolean).sort(),
        pay_periods:         payPeriods.filter(Boolean).sort()
    };
}

/**
 * createJobService
 * ----------------
 * Lógica para:
 *   POST /api/jobs
 *
 * @param {Object} payload - Cuerpo de la request (req.body).
 * @returns {Promise<Object>} Job recién creado, formateado con company.
 */
export async function createJobService(payload) {
    const job = await Job.create(payload);
    const [formatted] = await attachCompanyAndFormatJobs([job]);
    return formatted;
}

/**
 * updateJobService
 * ----------------
 * Lógica para:
 *   PUT /api/jobs/:id
 *
 * @param {string} id - ID de Mongo del Job a actualizar.
 * @param {Object} payload - Cuerpo de la request (campos a actualizar).
 * @returns {Promise<Object|null>} Job actualizado formateado o null si no existe.
 */
export async function updateJobService(id, payload) {
    const updated = await Job.findByIdAndUpdate(id, payload, { new: true });

    if (!updated) return null;

    const [formatted] = await attachCompanyAndFormatJobs([updated]);
    return formatted;
}

/**
 * deleteJobService
 * ----------------
 * Lógica para:
 *   DELETE /api/jobs/:id
 *
 * @param {string} id - ID de Mongo del Job a eliminar.
 * @returns {Promise<boolean>} true si se eliminó, false si no existía.
 */
export async function deleteJobService(id) {
    const deleted = await Job.findByIdAndDelete(id);
    return Boolean(deleted);
}
