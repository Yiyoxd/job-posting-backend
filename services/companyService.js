/**
 * ============================================================================
 *  companyService.js — LÓGICA DE NEGOCIO DE EMPRESAS (RANKER PRO + LOGO FULLPATH)
 * ============================================================================
 *
 * Este archivo NO usa Express ni req/res.
 * Solo expone funciones de servicio que:
 *   - Consultan la colección Company (y Job para /:id/jobs)
 *   - Aplican filtros, paginación y ordenamiento
 *   - Implementan un RANKER AVANZADO cuando hay q y NO hay sortBy
 *   - Adjuntan siempre logo_full_path basado en company_id
 *
 * Funciones expuestas (usadas por companyController):
 *
 *   ✔ listCompaniesService(queryParams)
 *        → Listado de empresas con filtros + paginación + rank inteligente.
 *
 *   ✔ getCompanyByIdService(id)
 *        → Una empresa (o null si no existe).
 *
 *   ✔ getCompanyJobsService(companyId, queryParams)
 *        → Empleos de una empresa con filtros + paginación (listados simples).
 *
 *   ✔ getCompanyFilterOptionsService()
 *        → Distincts para filtros: países, estados, ciudades.
 *
 *   ✔ createCompanyService(payload)
 *        ✔ updateCompanyService(id, payload)
 *        ✔ deleteCompanyService(id)
 *
 * Todas las respuestas que incluyen empresas llevan:
 *   - TODOS los campos tal como están en MongoDB
 *   - UN campo extra:
 *       logo_full_path: string | null
 *         → URL COMPLETA del logo basado en company_id
 *            p.ej. "http://localhost:8000/company_logos/processed/268.png"
 * ============================================================================
 */

import Company from "../models/Company.js";
import Job from "../models/Job.js";

/* ============================================================================
 *  LOGO FULLPATH (MISMA LÓGICA QUE EN JOBS: TODO POR CONSTANTES)
 * ============================================================================
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Quitar sufijo /api si viene así (para que las imágenes salgan en el host raíz)
const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// Prefijo público donde Express sirve los logos
//   /company_logos  → expone data/company_logos
const LOGO_PUBLIC_PREFIX = "/company_logos";

// Subcarpeta real donde quedaron los logos procesados
const LOGO_PROCESSED_DIR = "processed";

// Path relativo que el navegador debe pedir:
//   /company_logos/processed/<company_id>.png
const LOGO_RELATIVE_DIR = `${LOGO_PUBLIC_PREFIX}/${LOGO_PROCESSED_DIR}`;

/**
 * buildLogoFullPath
 * -----------------
 * Devuelve la URL COMPLETA del logo a partir de company_id.
 *
 *   company_id = 268 →
 *   "http://localhost:8000/company_logos/processed/268.png"
 *
 * Si companyId es null/undefined o string vacía, regresa null.
 */
export function buildLogoFullPath(companyId) {
    if (companyId === undefined || companyId === null) return null;

    const idStr = String(companyId).trim();
    if (!idStr) return null;

    return `${ASSET_BASE_URL}${LOGO_RELATIVE_DIR}/${idStr}.png`;
}

/* ============================================================================
 *  HELPERS GENÉRICOS (NUMÉRICOS, PAGINACIÓN, NORMALIZACIÓN)
 * ============================================================================
 */

/**
 * parseNumber
 * -----------
 * Parsea un número desde query string. Devuelve null si no es válido.
 */
function parseNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/**
 * buildPaginationParams
 * ---------------------
 * Crea page, limit y skip a partir de queryParams.
 *
 *   - page  es 1-based (min: 1)
 *   - limit es >= 1 (default 20)
 */
function buildPaginationParams(queryParams = {}) {
    const page = Math.max(parseInt(queryParams.page || "1", 10), 1);
    const limit = Math.max(parseInt(queryParams.limit || "20", 10), 1);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
}

/**
 * normalize
 * ---------
 * Normaliza una cadena para comparar/buscar:
 *   - Convierte a string
 *   - Minúsculas
 *   - Normaliza Unicode (NFD)
 *   - Quita acentos
 *   - Reemplaza símbolos por espacios
 *   - Colapsa espacios
 *   - trim
 */
function normalize(str = "") {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^a-z0-9\s]/g, " ")    // símbolos → espacio
        .replace(/\s+/g, " ")            // colapsar espacios
        .trim();
}

/**
 * normalizeSearchTerm
 * -------------------
 * Versión especial para q:
 *   - trim inicial
 *   - colapsa espacios
 *   - luego pasa por normalize()
 *
 * Si queda vacío, devuelve null.
 */
function normalizeSearchTerm(qRaw) {
    if (qRaw === undefined || qRaw === null) return null;
    const s = String(qRaw).trim().replace(/\s+/g, " ");
    const n = normalize(s);
    return n || null;
}

/**
 * tokenize
 * --------
 * Convierte un string en tokens únicos (palabras) normalizados.
 */
function tokenize(str = "") {
    const n = normalize(str);
    if (!n) return [];
    const parts = n.split(" ").filter(Boolean);
    return [...new Set(parts)];
}

/**
 * toPlainCompany
 * --------------
 * Acepta un documento de Mongoose o un objeto plano y devuelve
 * siempre un objeto plano normal.
 */
function toPlainCompany(doc) {
    if (!doc) return null;
    if (typeof doc.toObject === "function") return doc.toObject();
    if (typeof doc.toJSON === "function") return doc.toJSON();
    return { ...doc };
}

/**
 * attachLogoFullPath
 * ------------------
 * Recibe una empresa (doc o plain object) y retorna un objeto
 * con TODOS los campos originales + logo_full_path calculado.
 *
 * NO elimina _id ni ningún otro campo.
 */
function attachLogoFullPath(companyDocOrPlain) {
    const plain = toPlainCompany(companyDocOrPlain);
    if (!plain) return plain;

    return {
        ...plain,
        logo_full_path: buildLogoFullPath(plain.company_id)
    };
}

/* ============================================================================
 *  FILTROS Y ORDENAMIENTO BASE PARA COMPANIES
 * ============================================================================
 */

/**
 * buildCompanyFilters
 * -------------------
 * Construye filtros para la entidad Company a partir de queryParams.
 *
 * Filtros soportados:
 *   - q          → Búsqueda por nombre / descripción (solo si includeTextFilter = true)
 *   - country    → País
 *   - state      → Estado
 *   - city       → Ciudad
 *   - min_size   → Tamaño mínimo (company_size_max >= min_size)
 *   - max_size   → Tamaño máximo (company_size_min <= max_size)
 *
 * @param {Object} queryParams
 * @param {Object} options
 *   - includeTextFilter: boolean (default true)
 *       * true  → aplica filtro $or con regex sobre name / description
 *       * false → ignora q (el ranker se encarga de la relevancia)
 */
function buildCompanyFilters(
    queryParams = {},
    { includeTextFilter = true } = {}
) {
    const {
        q,
        country,
        state,
        city,
        min_size,
        max_size
    } = queryParams;

    const filter = {};

    // Búsqueda por texto (nombre / descripción) — SOLO si queremos filtro simple
    if (includeTextFilter && q && q.trim()) {
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

    // company_size_max >= min_size
    if (minSize !== null) {
        filter.company_size_max = {
            ...(filter.company_size_max || {}),
            $gte: minSize
        };
    }

    // company_size_min <= max_size
    if (maxSize !== null) {
        filter.company_size_min = {
            ...(filter.company_size_min || {}),
            $lte: maxSize
        };
    }

    return filter;
}

/**
 * buildCompanySort
 * ----------------
 * Construye objeto sort para Company.
 *
 * Campos permitidos:
 *   - name
 *   - createdAt
 *   - country
 */
function buildCompanySort(queryParams = {}) {
    const { sortBy, sortDir } = queryParams;

    const allowed = new Set(["name", "createdAt", "country"]);
    const field = allowed.has(sortBy) ? sortBy : "name";
    const direction = sortDir === "desc" ? -1 : 1;

    return { [field]: direction };
}

/* ============================================================================
 *  RANKER SÚPER INTELIGENTE PARA EMPRESAS (CUANDO HAY q Y NO HAY sortBy)
 * ============================================================================
 *
 * La idea es similar a finalScore del JobController, pero adaptado a Company:
 *
 *   Campos considerados:
 *     - name         (nombre de la empresa)
 *     - description  (descripción de la empresa)
 *     - ubicación    (country + state + city)
 *
 *   Señales de ranking:
 *     1. Coincidencias directas de la frase q:
 *          - Exacto en name
 *          - Prefijo de name
 *          - Substring en name
 *          - Exacto/prefijo/substring en la ubicación completa
 *          - Substring en description
 *
 *     2. Tokens:
 *          - Cuántos tokens de q aparecen en name / description / ubicación
 *          - Coverage (qué porcentaje de tokens cubre cada uno)
 *          - Si TODOS los tokens de q están cubiertos (full coverage)
 *          - Tokens en el mismo orden en el nombre
 *
 *     3. Longitud:
 *          - Se premia que name y q tengan longitudes similares
 *
 *     4. Bonus extra:
 *          - Si el conjunto de tokens de q coincide casi exactamente con el
 *            conjunto de tokens del nombre de la empresa.
 */

/**
 * computeCompanyScore
 * -------------------
 * Calcula un score de relevancia para una empresa.
 *
 * @param {Object} company - plain object de Company.
 * @param {string} qNorm   - query normalizada (normalizeSearchTerm).
 * @param {string[]} qTokens - tokens de la query.
 *
 * @returns {number} score > 0 si es relevante, 0 si no.
 */
function computeCompanyScore(company, qNorm, qTokens) {
    if (!qNorm) return 0;

    const name = company.name || "";
    const description = company.description || "";
    const country = company.country || "";
    const state = company.state || "";
    const city = company.city || "";

    const locationStr = `${country} ${state} ${city}`.trim();

    const nameNorm = normalize(name);
    const descNorm = normalize(description);
    const locNorm = normalize(locationStr);

    const tokensName = tokenize(name);
    const tokensDesc = tokenize(description);
    const tokensLoc  = tokenize(locationStr);
    const tokensAll  = [...new Set([...tokensName, ...tokensDesc, ...tokensLoc])];

    // Chequeo rápido: si no hay ningún match básico, descartamos
    const hasTokenOverlap =
        qTokens.some(t => tokensAll.includes(t));

    const hasSubstring =
        (nameNorm && nameNorm.includes(qNorm)) ||
        (descNorm && descNorm.includes(qNorm)) ||
        (locNorm && locNorm.includes(qNorm)) ||
        (qNorm && tokensAll.some(t => qNorm.includes(t)));

    if (!hasTokenOverlap && !hasSubstring) {
        return 0;
    }

    /* ---------------------------------------------------------------
     * 1. COINCIDENCIAS DIRECTAS (NOMBRE / UBICACIÓN / DESCRIPCIÓN)
     * ------------------------------------------------------------ */
    const exactName = (qNorm === nameNorm) ? 400 : 0;
    const prefixName = !exactName && nameNorm.startsWith(qNorm) ? 260 : 0;
    const containsName =
        !exactName && !prefixName && nameNorm.includes(qNorm) ? 180 : 0;

    const exactLoc = locNorm && qNorm === locNorm ? 220 : 0;
    const prefixLoc = locNorm && !exactLoc && locNorm.startsWith(qNorm) ? 170 : 0;
    const containsLoc =
        locNorm && !exactLoc && !prefixLoc && locNorm.includes(qNorm) ? 140 : 0;

    const containsDesc = descNorm && descNorm.includes(qNorm) ? 90 : 0;

    /* ---------------------------------------------------------------
     * 2. TOKENS: COVERAGE Y DISTRIBUCIÓN
     * ------------------------------------------------------------ */
    const uniqueQTokens = [...new Set(qTokens)];
    const totalTokens = uniqueQTokens.length || 1;

    let matchName = 0;
    let matchDesc = 0;
    let matchLoc  = 0;
    let matchAll  = 0;

    for (const t of uniqueQTokens) {
        if (tokensName.includes(t)) matchName++;
        if (tokensDesc.includes(t)) matchDesc++;
        if (tokensLoc.includes(t))  matchLoc++;
        if (tokensAll.includes(t))  matchAll++;
    }

    const rName = matchName / totalTokens;
    const rDesc = matchDesc / totalTokens;
    const rLoc  = matchLoc  / totalTokens;
    const rAll  = matchAll  / totalTokens;

    let coverageScore = 0;

    // Coverage en nombre (muy importante)
    if (rName === 1) {
        coverageScore += 200;
    } else if (rName > 0) {
        coverageScore += Math.round(rName * 140);
    }

    // Coverage en descripción (apoya, pero menos que el nombre)
    coverageScore += Math.round(rDesc * 60);

    // Coverage en ubicación (muy relevante cuando query incluye país/ciudad)
    coverageScore += Math.round(rLoc * 160);

    // Coverage global
    if (rAll === 1) {
        coverageScore += 150;
    } else if (rAll > 0) {
        coverageScore += Math.round(rAll * 120);
    }

    // Per-token (para distinguir cuando hay muchos tokens coincidiendo)
    const perTokenScore =
        matchName * 35 +
        matchLoc  * 30 +
        matchDesc * 15;

    /* ---------------------------------------------------------------
     * 3. ORDEN DE TOKENS EN EL NOMBRE
     * ------------------------------------------------------------ */
    let inOrderScore = 0;
    if (tokensName.length && uniqueQTokens.length >= 2) {
        // Intentamos encontrar los tokens de q en orden dentro de tokensName
        let i = 0;
        let j = 0;
        while (i < tokensName.length && j < uniqueQTokens.length) {
            if (tokensName[i] === uniqueQTokens[j]) {
                j++;
            }
            i++;
        }
        const inOrderRatio = j / uniqueQTokens.length;
        if (inOrderRatio === 1) {
            inOrderScore = 100;
        } else if (inOrderRatio >= 0.5) {
            inOrderScore = 50;
        }
    }

    /* ---------------------------------------------------------------
     * 4. LONGITUD: SIMILITUD ENTRE q Y name
     * ------------------------------------------------------------ */
    const lenDiff = Math.abs(qNorm.length - nameNorm.length);
    const lengthScore = Math.max(0, 60 - Math.min(lenDiff, 60));

    /* ---------------------------------------------------------------
     * 5. BONUS EXTRA: MISMOS TOKENS EN NOMBRE Y QUERY
     * ------------------------------------------------------------ */
    const sameTokensSet =
        tokensName.length &&
        uniqueQTokens.length === tokensName.length &&
        uniqueQTokens.every(t => tokensName.includes(t));

    const sameTokensScore = sameTokensSet ? 180 : 0;

    /* ---------------------------------------------------------------
     * 6. SUMA FINAL
     * ------------------------------------------------------------ */
    const finalScore =
        exactName +
        prefixName +
        containsName +
        exactLoc +
        prefixLoc +
        containsLoc +
        containsDesc +
        coverageScore +
        perTokenScore +
        inOrderScore +
        lengthScore +
        sameTokensScore;

    return finalScore > 0 ? finalScore : 0;
}

/**
 * listCompaniesRanked
 * -------------------
 * MODO "RANKER PRO":
 *   - Se activa cuando:
 *       * hay q normalizado (safeQ)
 *       * NO hay sortBy (el orden lo define el ranker)
 *
 * Lógica:
 *   1. Construye filtros base SIN q (includeTextFilter = false).
 *   2. Obtiene todas las empresas que pasan los filtros base.
 *   3. Calcula un score para cada una con computeCompanyScore.
 *   4. Descarta las de score 0.
 *   5. Ordena por score desc, luego name asc, luego createdAt desc.
 *   6. Aplica paginación en memoria.
 *   7. Adjunta logo_full_path.
 */
async function listCompaniesRanked(queryParams = {}) {
    const { page, limit } = buildPaginationParams(queryParams);

    const safeQ = normalizeSearchTerm(queryParams.q);
    if (!safeQ) {
        // Por seguridad: si algo raro pasa, caemos al modo simple
        return listCompaniesSimple(queryParams);
    }

    const filters = buildCompanyFilters(queryParams, {
        includeTextFilter: false
    });

    // Traemos las empresas que cumplen los filtros base
    const candidates = await Company.find(filters).lean();

    const qTokens = tokenize(safeQ);
    const scored = [];

    for (const c of candidates) {
        const score = computeCompanyScore(c, safeQ, qTokens);
        if (score <= 0) continue;

        scored.push({ score, company: c });
    }

    // Orden por score desc, luego name asc, luego createdAt desc
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const nameA = (a.company.name || "").toLowerCase();
        const nameB = (b.company.name || "").toLowerCase();
        const cmpName = nameA.localeCompare(nameB);
        if (cmpName !== 0) return cmpName;

        const createdA = a.company.createdAt
            ? new Date(a.company.createdAt).getTime()
            : 0;
        const createdB = b.company.createdAt
            ? new Date(b.company.createdAt).getTime()
            : 0;

        return createdB - createdA;
    });

    const total = scored.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const end = start + limit;

    const pageItems = scored.slice(start, end).map(item => item.company);
    const dataWithLogo = pageItems.map(attachLogoFullPath);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages
        },
        data: dataWithLogo
    };
}

/**
 * listCompaniesSimple
 * -------------------
 * MODO SIMPLE (sin rank avanzado):
 *   - Se usa cuando:
 *       * no hay q, o
 *       * hay q PERO el cliente envió sortBy (entonces se respeta sortBy/sortDir)
 *
 * Lógica:
 *   - Aplica buildCompanyFilters con includeTextFilter = true (usa regex).
 *   - Aplica buildCompanySort.
 *   - Aplica paginación con skip/limit en Mongo.
 *   - Adjunta logo_full_path.
 */
async function listCompaniesSimple(queryParams = {}) {
    const { page, limit, skip } = buildPaginationParams(queryParams);
    const filters = buildCompanyFilters(queryParams, {
        includeTextFilter: true
    });
    const sort = buildCompanySort(queryParams);

    const [total, companies] = await Promise.all([
        Company.countDocuments(filters),
        Company.find(filters)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const dataWithLogo = companies.map(attachLogoFullPath);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages
        },
        data: dataWithLogo
    };
}

/* ============================================================================
 *  SERVICIO PRINCIPAL DE LISTADO
 * ============================================================================
 */

/**
 * listCompaniesService
 * --------------------
 * Lógica para:
 *   GET /api/companies
 *
 * Modo de operación:
 *   - Si hay q (después de normalizar) Y NO hay sortBy →
 *       → modo ranker avanzado (listCompaniesRanked)
 *
 *   - En cualquier otro caso →
 *       → modo simple (listCompaniesSimple)
 *
 * Contrato de salida:
 *   {
 *     meta: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number
 *     },
 *     data: Array<Company & { logo_full_path: string | null }>
 *   }
 */
export async function listCompaniesService(queryParams = {}) {
    const safeQ = normalizeSearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    if (safeQ && !hasCustomSort) {
        // Usamos el q normalizado internamente
        const normalizedParams = { ...queryParams, q: safeQ };
        return listCompaniesRanked(normalizedParams);
    }

    return listCompaniesSimple(queryParams);
}

/* ============================================================================
 *  OTROS SERVICIOS
 * ============================================================================
 */

/**
 * getCompanyByIdService
 * ---------------------
 * Lógica para:
 *   GET /api/companies/:id
 *
 * @param {string} id - _id de MongoDB.
 *
 * @returns {Promise<object | null>}
 *   - objeto Company + logo_full_path
 *   - null si no existe
 */
export async function getCompanyByIdService(id) {
    const company = await Company.findById(id).lean();
    if (!company) return null;

    return attachLogoFullPath(company);
}

/**
 * getCompanyJobsService
 * ---------------------
 * Lógica para:
 *   GET /api/companies/:id/jobs
 *
 * Soporta filtros básicos (los mismos que tenías):
 *   - country
 *   - state
 *   - city
 *   - work_type
 *   - pay_period
 *
 * Orden:
 *   - Siempre por listed_time desc (recientes primero).
 *
 * @returns {
 *   meta: { page, limit, total, totalPages },
 *   data: Job[]
 * }
 */
export async function getCompanyJobsService(companyId, queryParams = {}) {
    const { page, limit, skip } = buildPaginationParams(queryParams);

    const { country, state, city, work_type, pay_period } = queryParams;

    const filters = { company_id: companyId };

    if (country)    filters.country = country;
    if (state)      filters.state = state;
    if (city)       filters.city = city;
    if (work_type)  filters.work_type = work_type;
    if (pay_period) filters.pay_period = pay_period;

    const [total, jobs] = await Promise.all([
        Job.countDocuments(filters),
        Job.find(filters)
            .sort({ listed_time: -1 })
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

/**
 * getCompanyFilterOptionsService
 * ------------------------------
 * Lógica para:
 *   GET /api/companies/filters/options
 *
 * Devuelve distincts:
 *   - countries
 *   - states
 *   - cities
 */
export async function getCompanyFilterOptionsService() {
    const [countries, states, cities] = await Promise.all([
        Company.distinct("country"),
        Company.distinct("state"),
        Company.distinct("city")
    ]);

    return {
        countries: countries.filter(Boolean).sort(),
        states:    states.filter(Boolean).sort(),
        cities:    cities.filter(Boolean).sort()
    };
}

/**
 * createCompanyService
 * --------------------
 * Lógica para:
 *   POST /api/companies
 *
 * @param {object} payload - req.body con los datos de la empresa.
 *
 * @returns {Promise<object>} Empresa creada + logo_full_path
 */
export async function createCompanyService(payload) {
    const created = await Company.create(payload);
    return attachLogoFullPath(created);
}

/**
 * updateCompanyService
 * --------------------
 * Lógica para:
 *   PUT /api/companies/:id
 *
 * @param {string} id      - _id de MongoDB.
 * @param {object} payload - req.body con los campos a actualizar.
 *
 * @returns {Promise<object | null>}
 *   - empresa actualizada + logo_full_path
 *   - null si no existe
 */
export async function updateCompanyService(id, payload) {
    const updated = await Company.findByIdAndUpdate(
        id,
        payload,
        { new: true }
    ).lean();

    if (!updated) return null;

    return attachLogoFullPath(updated);
}

/**
 * deleteCompanyService
 * --------------------
 * Lógica para:
 *   DELETE /api/companies/:id
 *
 * @param {string} id - _id de MongoDB.
 *
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteCompanyService(id) {
    const deleted = await Company.findByIdAndDelete(id);
    return { deleted: Boolean(deleted) };
}
