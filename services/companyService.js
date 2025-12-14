// services/companyService.js

/**
 * ============================================================================
 * companyService.js — Lógica de negocio para Empresas (Company)
 * ============================================================================
 *
 * Este módulo NO depende de Express (no usa req/res).
 * Expone funciones “puras” que operan sobre Mongoose (Company, Job).
 *
 * ✅ Decisión de API pública (IMPORTANTE):
 * - Todas las operaciones “por id” usan company_id (numérico incremental).
 * - NO se usa el _id de Mongo para GET/UPDATE/DELETE (frontend-friendly).
 *
 * Ejemplos esperados:
 * - GET    /api/companies/1075         -> company_id = 1075
 * - PATCH  /api/companies/1075         -> company_id = 1075
 * - DELETE /api/companies/1075         -> company_id = 1075
 * - GET    /api/companies/1075/jobs    -> company_id = 1075
 * - POST   /api/companies/1075/logo    -> company_id = 1075
 *
 * Contrato de salida:
 * - Cuando se retorna una empresa, se incluye:
 *     logo_full_path: string | null
 *   calculado a partir de company_id con la convención pública del backend.
 * ============================================================================
 */

import Company from "../models/Company.js";
import Job from "../models/Job.js";

import fs from "fs";
import path from "path";
import sharp from "sharp";

import { standardizeLogo, DEFAULT_LOGO_SIZE } from "../utils/imageProcessor.js";

import { buildPaginationParams } from "../utils/paginationUtils.js";
import { parseNumber, normalizeSearchTerm as normalizeSearchTermBasic } from "../utils/parsingUtils.js";
import { buildLogoFullPath } from "../utils/assets/logoUtils.js";

/* =============================================================================
 * Helpers internos (normalización + ranker)
 * =============================================================================
 */

/**
 * Normaliza un string para comparaciones “humanas”:
 * - minúsculas
 * - normaliza unicode (NFD)
 * - elimina diacríticos
 * - reemplaza símbolos por espacios
 * - colapsa espacios
 * - trim
 * @param {string} str
 * @returns {string}
 */
function normalizeHuman(str = "") {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Normaliza la búsqueda `q` para ranker de empresas:
 * - trim + colapsa espacios
 * - aplica normalizeHuman
 * Si queda vacío, retorna null.
 * @param {any} qRaw
 * @returns {string|null}
 */
function normalizeCompanySearchTerm(qRaw) {
    const basic = normalizeSearchTermBasic(qRaw); // trim + colapsa + lower
    if (!basic) return null;
    const n = normalizeHuman(basic);
    return n || null;
}

/**
 * Tokeniza un string normalizado en tokens únicos.
 * @param {string} str
 * @returns {string[]}
 */
function tokenize(str = "") {
    const n = normalizeHuman(str);
    if (!n) return [];
    return [...new Set(n.split(" ").filter(Boolean))];
}

/**
 * Convierte doc/obj a plain object.
 * @param {any} doc
 * @returns {Object|null}
 */
function toPlainCompany(doc) {
    if (!doc) return null;
    if (typeof doc.toObject === "function") return doc.toObject();
    if (typeof doc.toJSON === "function") return doc.toJSON();
    return { ...doc };
}

/**
 * Adjunta logo_full_path preservando todos los campos originales.
 * @param {any} companyDocOrPlain
 * @returns {Object|null}
 */
function attachLogoFullPath(companyDocOrPlain) {
    const plain = toPlainCompany(companyDocOrPlain);
    if (!plain) return null;

    return {
        ...plain,
        logo_full_path: buildLogoFullPath(plain.company_id)
    };
}

/**
 * Normaliza un "id" público a número (company_id).
 * Regresa null si no es válido.
 * @param {any} raw
 * @returns {number|null}
 */
function toCompanyId(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    return n;
}

/* =============================================================================
 * Filtros y ordenamiento base para Company
 * =============================================================================
 */

/**
 * Construye filtros para Company.
 * Soporta:
 * - q (regex simple) si includeTextFilter = true
 * - country, state, city
 * - min_size (company_size_max >= min_size)
 * - max_size (company_size_min <= max_size)
 *
 * @param {Object} queryParams
 * @param {{ includeTextFilter?: boolean }} options
 * @returns {Object}
 */
function buildCompanyFilters(queryParams = {}, { includeTextFilter = true } = {}) {
    const { q, country, state, city, min_size, max_size } = queryParams;

    const filter = {};

    if (includeTextFilter) {
        const raw = q !== undefined && q !== null ? String(q).trim() : "";
        if (raw) {
            const regex = new RegExp(raw, "i");
            filter.$or = [{ name: regex }, { description: regex }];
        }
    }

    if (country) filter.country = country;
    if (state) filter.state = state;
    if (city) filter.city = city;

    const minSize = parseNumber(min_size);
    const maxSize = parseNumber(max_size);

    if (minSize !== null) {
        filter.company_size_max = {
            ...(filter.company_size_max || {}),
            $gte: minSize
        };
    }

    if (maxSize !== null) {
        filter.company_size_min = {
            ...(filter.company_size_min || {}),
            $lte: maxSize
        };
    }

    return filter;
}

/**
 * Ordenamiento permitido para Company.
 * sortBy: name | createdAt | country
 * sortDir: asc | desc
 *
 * @param {Object} queryParams
 * @returns {Object}
 */
function buildCompanySort(queryParams = {}) {
    const { sortBy, sortDir } = queryParams;

    const allowed = new Set(["name", "createdAt", "country"]);
    const field = allowed.has(sortBy) ? sortBy : "name";
    const direction = sortDir === "desc" ? -1 : 1;

    return { [field]: direction };
}

/* =============================================================================
 * Ranker avanzado (cuando hay q y no hay sortBy)
 * =============================================================================
 */

/**
 * Calcula un score de relevancia para una empresa dada una query normalizada.
 * @param {Object} company
 * @param {string} qNorm
 * @param {string[]} qTokens
 * @returns {number}
 */
function computeCompanyScore(company, qNorm, qTokens) {
    if (!qNorm) return 0;

    const name = company.name || "";
    const description = company.description || "";
    const country = company.country || "";
    const state = company.state || "";
    const city = company.city || "";

    const locationStr = `${country} ${state} ${city}`.trim();

    const nameNorm = normalizeHuman(name);
    const descNorm = normalizeHuman(description);
    const locNorm = normalizeHuman(locationStr);

    const tokensName = tokenize(name);
    const tokensDesc = tokenize(description);
    const tokensLoc = tokenize(locationStr);
    const tokensAll = [...new Set([...tokensName, ...tokensDesc, ...tokensLoc])];

    const hasTokenOverlap = qTokens.some((t) => tokensAll.includes(t));
    const hasSubstring =
        (nameNorm && nameNorm.includes(qNorm)) ||
        (descNorm && descNorm.includes(qNorm)) ||
        (locNorm && locNorm.includes(qNorm));

    if (!hasTokenOverlap && !hasSubstring) return 0;

    // 1) Coincidencias directas
    const exactName = qNorm === nameNorm ? 400 : 0;
    const prefixName = !exactName && nameNorm.startsWith(qNorm) ? 260 : 0;
    const containsName = !exactName && !prefixName && nameNorm.includes(qNorm) ? 180 : 0;

    const exactLoc = locNorm && qNorm === locNorm ? 220 : 0;
    const prefixLoc = locNorm && !exactLoc && locNorm.startsWith(qNorm) ? 170 : 0;
    const containsLoc = locNorm && !exactLoc && !prefixLoc && locNorm.includes(qNorm) ? 140 : 0;

    const containsDesc = descNorm && descNorm.includes(qNorm) ? 90 : 0;

    // 2) Tokens: coverage
    const uniqueQTokens = [...new Set(qTokens)];
    const totalTokens = uniqueQTokens.length || 1;

    let matchName = 0;
    let matchDesc = 0;
    let matchLoc = 0;
    let matchAll = 0;

    for (const t of uniqueQTokens) {
        if (tokensName.includes(t)) matchName++;
        if (tokensDesc.includes(t)) matchDesc++;
        if (tokensLoc.includes(t)) matchLoc++;
        if (tokensAll.includes(t)) matchAll++;
    }

    const rName = matchName / totalTokens;
    const rDesc = matchDesc / totalTokens;
    const rLoc = matchLoc / totalTokens;
    const rAll = matchAll / totalTokens;

    let coverageScore = 0;

    if (rName === 1) coverageScore += 200;
    else if (rName > 0) coverageScore += Math.round(rName * 140);

    coverageScore += Math.round(rDesc * 60);
    coverageScore += Math.round(rLoc * 160);

    if (rAll === 1) coverageScore += 150;
    else if (rAll > 0) coverageScore += Math.round(rAll * 120);

    const perTokenScore = matchName * 35 + matchLoc * 30 + matchDesc * 15;

    // 3) Orden de tokens en nombre
    let inOrderScore = 0;
    if (tokensName.length && uniqueQTokens.length >= 2) {
        let i = 0;
        let j = 0;
        while (i < tokensName.length && j < uniqueQTokens.length) {
            if (tokensName[i] === uniqueQTokens[j]) j++;
            i++;
        }
        const inOrderRatio = j / uniqueQTokens.length;
        if (inOrderRatio === 1) inOrderScore = 100;
        else if (inOrderRatio >= 0.5) inOrderScore = 50;
    }

    // 4) Similitud de longitud
    const lenDiff = Math.abs(qNorm.length - nameNorm.length);
    const lengthScore = Math.max(0, 60 - Math.min(lenDiff, 60));

    // 5) Bonus: mismos tokens en nombre y query
    const sameTokensSet =
        tokensName.length &&
        uniqueQTokens.length === tokensName.length &&
        uniqueQTokens.every((t) => tokensName.includes(t));

    const sameTokensScore = sameTokensSet ? 180 : 0;

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
 * Listado con ranking avanzado (q presente, sortBy ausente).
 * Aplica filtros base SIN q, calcula score en memoria y pagina.
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listCompaniesRanked(queryParams = {}) {
    const { page, limit } = buildPaginationParams(queryParams);

    const safeQ = normalizeCompanySearchTerm(queryParams.q);
    if (!safeQ) {
        return listCompaniesSimple(queryParams);
    }

    const filters = buildCompanyFilters(queryParams, { includeTextFilter: false });
    const candidates = await Company.find(filters).lean();

    const qTokens = tokenize(safeQ);
    const scored = [];

    for (const c of candidates) {
        const score = computeCompanyScore(c, safeQ, qTokens);
        if (score > 0) scored.push({ score, company: c });
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const nameA = (a.company.name || "").toLowerCase();
        const nameB = (b.company.name || "").toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;

        const createdA = a.company.createdAt ? new Date(a.company.createdAt).getTime() : 0;
        const createdB = b.company.createdAt ? new Date(a.company.createdAt).getTime() : 0;
        return createdB - createdA;
    });

    const total = scored.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const end = start + limit;

    const pageItems = scored.slice(start, end).map((x) => x.company);

    return {
        meta: { page, limit, total, totalPages },
        data: pageItems.map(attachLogoFullPath)
    };
}

/**
 * Listado simple: filtros + regex(q) + sortBy/sortDir + paginación en Mongo.
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
async function listCompaniesSimple(queryParams = {}) {
    const { page, limit, skip } = buildPaginationParams(queryParams);

    const filters = buildCompanyFilters(queryParams, { includeTextFilter: true });
    const sort = buildCompanySort(queryParams);

    const [total, companies] = await Promise.all([
        Company.countDocuments(filters),
        Company.find(filters).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: { page, limit, total, totalPages },
        data: companies.map(attachLogoFullPath)
    };
}

/* =============================================================================
 * Servicios expuestos
 * =============================================================================
 */

/**
 * Servicio: listado de empresas.
 * - Si hay q normalizada y NO hay sortBy => ranking avanzado.
 * - En cualquier otro caso => listado simple.
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
export async function listCompaniesService(queryParams = {}) {
    const safeQ = normalizeCompanySearchTerm(queryParams.q);
    const hasCustomSort = Boolean(queryParams.sortBy);

    if (safeQ && !hasCustomSort) {
        return listCompaniesRanked({ ...queryParams, q: safeQ });
    }

    return listCompaniesSimple(queryParams);
}

/**
 * Servicio: obtener empresa por ID público (company_id).
 *
 * @param {string|number} id  -> company_id
 * @returns {Promise<Object|null>}
 */
export async function getCompanyByIdService(id) {
    const companyId = toCompanyId(id);
    if (companyId === null) return null;

    const company = await Company.findOne({ company_id: companyId }).lean();
    if (!company) return null;

    return attachLogoFullPath(company);
}

/**
 * Servicio: empleos de una empresa (listado simple).
 * Orden fijo: listed_time desc.
 * @param {any} companyIdRaw -> company_id
 * @param {Object} queryParams
 * @returns {Promise<{ meta: Object, data: Array }>}
 */
export async function getCompanyJobsService(companyIdRaw, queryParams = {}) {
    const companyId = toCompanyId(companyIdRaw);
    if (companyId === null) {
        return { meta: { page: 1, limit: 0, total: 0, totalPages: 1 }, data: [] };
    }

    const { page, limit, skip } = buildPaginationParams(queryParams);

    const { country, state, city, work_type, pay_period } = queryParams;

    const filters = { company_id: companyId };

    if (country) filters.country = country;
    if (state) filters.state = state;
    if (city) filters.city = city;
    if (work_type) filters.work_type = work_type;
    if (pay_period) filters.pay_period = pay_period;

    const [total, jobs] = await Promise.all([
        Job.countDocuments(filters),
        Job.find(filters).sort({ listed_time: -1 }).skip(skip).limit(limit).lean()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        meta: { page, limit, total, totalPages },
        data: jobs
    };
}

/**
 * Servicio: crear empresa.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createCompanyService(payload) {
    const created = await Company.create(payload);
    return attachLogoFullPath(created);
}

/**
 * Servicio: actualizar empresa por ID público (company_id).
 * NOTA: Se mantiene el nombre para que tu controller/ruta no cambie.
 *
 * @param {string|number} id -> company_id
 * @param {Object} payload
 * @returns {Promise<Object|null>}
 */
export async function updateCompanyService(id, payload) {
    const companyId = toCompanyId(id);
    if (companyId === null) return null;

    const updated = await Company.findOneAndUpdate(
        { company_id: companyId },
        payload,
        { new: true }
    ).lean();

    if (!updated) return null;
    return attachLogoFullPath(updated);
}

/**
 * Servicio: eliminar empresa por ID público (company_id).
 * @param {string|number} id -> company_id
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteCompanyService(id) {
    const companyId = toCompanyId(id);
    if (companyId === null) return { deleted: false };

    const deleted = await Company.findOneAndDelete({ company_id: companyId });
    return { deleted: Boolean(deleted) };
}

/* =============================================================================
 * Logo upload: guarda <company_id>.png en original y processed
 * =============================================================================
 */

/**
 * Actualiza el logo de una empresa usando ID público (company_id).
 *
 * Reglas:
 * - Nombre fijo del archivo: <company_id>.png
 * - Se sobrescribe si existe
 * - Se guarda en:
 *     data/company_logos/original/<company_id>.png
 *     data/company_logos/processed/<company_id>.png
 *
 * Uso típico (desde controller con multer memoryStorage):
 * - companyId: req.params.id           -> company_id
 * - fileBuffer: req.file.buffer
 *
 * @param {string|number} companyIdRaw
 * @param {Buffer} fileBuffer
 * @returns {Promise<Object|null>} Empresa (con logo_full_path) o null si no existe
 */
export async function updateCompanyLogoService(companyIdRaw, fileBuffer) {
    const companyId = toCompanyId(companyIdRaw);
    if (companyId === null) return null;

    const company = await Company.findOne({ company_id: companyId }).lean();
    if (!company) return null;

    const ROOT = process.cwd();
    const BASE_DIR = path.join(ROOT, "data", "company_logos");
    const ORIGINAL_DIR = path.join(BASE_DIR, "original");
    const PROCESSED_DIR = path.join(BASE_DIR, "processed");

    if (!fs.existsSync(ORIGINAL_DIR)) fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
    if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

    const fileName = `${companyId}.png`;
    const originalPath = path.join(ORIGINAL_DIR, fileName);

    // 1) Persistir ORIGINAL como PNG (forzando salida PNG)
    await sharp(fileBuffer).png().toFile(originalPath);

    // 2) Generar PROCESSED cuadrado con tu pipeline (mismo nombre final)
    await standardizeLogo(originalPath, PROCESSED_DIR, DEFAULT_LOGO_SIZE, fileName);

    return attachLogoFullPath(company);
}
