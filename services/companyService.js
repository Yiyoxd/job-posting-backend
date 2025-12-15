// services/companyService.js

/**
 * ============================================================================
 * companyService.js — Contratos de datos para el Frontend (Companies)
 * ============================================================================
 *
 * Este módulo define qué regresa el backend en cada operación relacionada con
 * Empresas y cómo se interpretan los parámetros que el frontend envía.
 *
 * Identificadores públicos (Frontend):
 * - company_id (number) es el ID público de la empresa.
 *
 * Campo de logo (Frontend):
 * - Todas las respuestas de empresa incluyen:
 *   logo_full_path: string | null
 *   (URL absoluta o null si no existe logo procesado).
 *
 * Formatos de respuesta:
 * - Listados:
 *   { meta: { page, limit, total, totalPages }, data: Company[] }
 * - Lectura/CRUD:
 *   Company (objeto plano con logo_full_path)
 * - Empleos de empresa:
 *   { meta: { page, limit, total, totalPages }, data: Job[] }
 *
 * Autenticación (Frontend):
 * - Lecturas (list/get/jobs): públicas.
 * - Escrituras (create/update/delete/logo): requieren token Bearer.
 *
 * Errores:
 * - Cuando hay error controlado, el controller lo traduce a JSON para el front.
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

import { requireActorType, requireCompanyScope, httpError } from "../utils/auth/actorAccessUtils.js";

/* =============================================================================
 * Helpers internos (normalización + ranker)
 * =============================================================================
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

function normalizeCompanySearchTerm(qRaw) {
    const basic = normalizeSearchTermBasic(qRaw);
    if (!basic) return null;
    const n = normalizeHuman(basic);
    return n || null;
}

function tokenize(str = "") {
    const n = normalizeHuman(str);
    if (!n) return [];
    return [...new Set(n.split(" ").filter(Boolean))];
}

function stripMongoFields(obj) {
    if (!obj || typeof obj !== "object") return obj;

    const {
        _id,
        __v,
        createdAt,
        updatedAt,
        ...rest
    } = obj;

    return rest;
}

function toPlainCompany(doc) {
    if (!doc) return null;

    let plain;
    if (typeof doc.toObject === "function") plain = doc.toObject();
    else if (typeof doc.toJSON === "function") plain = doc.toJSON();
    else plain = { ...doc };

    return stripMongoFields(plain);
}

/**
 * Adjunta el campo `logo_full_path` a una empresa.
 *
 * @param {Object|import("mongoose").Document} companyDocOrPlain
 * @returns {Object|null}
 *   Company con logo_full_path (o null si entrada inválida).
 */
export function attachLogoFullPath(companyDocOrPlain) {
    const plain = toPlainCompany(companyDocOrPlain);
    if (!plain) return null;

    return {
        ...plain,
        logo_full_path: buildLogoFullPath(plain.company_id)
    };
}

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
 * Construye filtros MongoDB para listado de empresas.
 *
 * Query params soportados (frontend):
 * - q: string
 *   Búsqueda simple (regex case-insensitive) por name/description.
 * - country: string
 * - state: string
 * - city: string
 * - min_size: number|string
 *   Filtra empresas cuyo company_size_max >= min_size.
 * - max_size: number|string
 *   Filtra empresas cuyo company_size_min <= max_size.
 *
 * @param {Object} queryParams
 * @param {Object} options
 * @param {boolean} [options.includeTextFilter=true]
 *   Si false, omite q->regex (se usa cuando el ranker avanzado evalúa por su cuenta).
 *
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
 * Ordenamiento permitido en listados.
 *
 * Query params:
 * - sortBy: "name" | "createdAt" | "country"
 * - sortDir: "asc" | "desc"
 *
 * Defaults:
 * - sortBy="name"
 * - sortDir="asc"
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

    const exactName = qNorm === nameNorm ? 400 : 0;
    const prefixName = !exactName && nameNorm.startsWith(qNorm) ? 260 : 0;
    const containsName = !exactName && !prefixName && nameNorm.includes(qNorm) ? 180 : 0;

    const exactLoc = locNorm && qNorm === locNorm ? 220 : 0;
    const prefixLoc = locNorm && !exactLoc && locNorm.startsWith(qNorm) ? 170 : 0;
    const containsLoc = locNorm && !exactLoc && !prefixLoc && locNorm.includes(qNorm) ? 140 : 0;

    const containsDesc = descNorm && descNorm.includes(qNorm) ? 90 : 0;

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

    const lenDiff = Math.abs(qNorm.length - nameNorm.length);
    const lengthScore = Math.max(0, 60 - Math.min(lenDiff, 60));

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
 * Listado con ranking inteligente.
 *
 * Se usa cuando:
 * - existe q
 * - y el frontend NO envía sortBy
 *
 * Respuesta:
 * - { meta, data }
 * - data: Company[] con logo_full_path
 *
 * @param {Object} queryParams
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: Object[] }>}
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
 * Listado con filtros + sort (sin ranking).
 *
 * @param {Object} queryParams
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: Object[] }>}
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
 * Servicios expuestos (lo que consume el controller)
 * =============================================================================
 */

/**
 * Lista empresas (pública).
 *
 * Query params (frontend):
 * - q: string
 * - country: string
 * - state: string
 * - city: string
 * - min_size: number|string
 * - max_size: number|string
 * - page: number|string (default: 1)
 * - limit: number|string (default: 20)
 * - sortBy: "name"|"createdAt"|"country"
 * - sortDir: "asc"|"desc"
 *
 * Regla de ranking:
 * - Si q existe y NO hay sortBy, se aplica ranking inteligente.
 *
 * Respuesta:
 * - { meta, data: Company[] }
 *
 * @param {Object} [queryParams={}]
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: Object[] }>}
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
 * Obtiene una empresa por company_id (pública).
 *
 * @param {string|number} id
 * @returns {Promise<Object|null>}
 * - Company con logo_full_path, o null si no existe / id inválido.
 */
export async function getCompanyByIdService(id) {
    const companyId = toCompanyId(id);
    if (companyId === null) return null;

    const company = await Company.findOne({ company_id: companyId }).lean();
    if (!company) return null;

    return attachLogoFullPath(company);
}

/**
 * Lista empleos de una empresa (pública).
 *
 * Path param (frontend):
 * - companyIdRaw: company_id
 *
 * Query params (frontend):
 * - page: number|string (default: 1)
 * - limit: number|string (default: 20)
 * - country: string
 * - state: string
 * - city: string
 * - work_type: string
 * - pay_period: string
 *
 * Respuesta:
 * - { meta, data: Job[] }
 *
 * @param {string|number} companyIdRaw
 * @param {Object} [queryParams={}]
 * @returns {Promise<{ meta: {page:number,limit:number,total:number,totalPages:number}, data: Object[] }>}
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
        data: jobs.map(stripMongoFields)
    };
}

/**
 * Crea una empresa (requiere autenticación).
 *
 * Auth (frontend):
 * - Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : permitido
 * - company: permitido SOLO si esa cuenta aún no tiene perfil de empresa
 *
 * Body (JSON):
 * - Campos del modelo Company (ejemplos):
 *   {
 *     "name": string,
 *     "description": string,
 *     "country": string,
 *     "state": string,
 *     "city": string,
 *     "address": string,
 *     "company_size_min": number,
 *     "company_size_max": number
 *   }
 *
 * Respuesta:
 * - Company con logo_full_path
 *
 * Errores típicos:
 * - 401/403: sin permisos
 * - 409: si una cuenta company ya tiene perfil de empresa
 *
 * @param {any} actor
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createCompanyService(actor, payload) {
    requireActorType(actor, ["admin", "company"]);

    if (actor.type === "company" && actor.company_id != null) {
        throw httpError(409, "Company profile already exists for this account");
    }

    const created = await Company.create(payload);
    return attachLogoFullPath(created);
}

/**
 * Actualiza una empresa por company_id (requiere autenticación).
 *
 * Auth (frontend):
 * - Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : puede actualizar cualquier empresa
 * - company: solo su propia empresa (actor.company_id === company_id)
 *
 * @param {any} actor
 * @param {string|number} id
 * @param {Object} payload
 * @returns {Promise<Object|null>}
 * - Company actualizado con logo_full_path, o null si no existe / id inválido.
 */
export async function updateCompanyService(actor, id, payload) {
    const companyId = toCompanyId(id);
    if (companyId === null) return null;

    requireCompanyScope(actor, companyId);

    const updated = await Company.findOneAndUpdate(
        { company_id: companyId },
        payload,
        { new: true }
    ).lean();

    if (!updated) return null;
    return attachLogoFullPath(updated);
}

/**
 * Elimina una empresa por company_id (requiere autenticación).
 *
 * Auth (frontend):
 * - Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : puede eliminar cualquier empresa
 * - company: solo su propia empresa (actor.company_id === company_id)
 *
 * @param {any} actor
 * @param {string|number} id
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteCompanyService(actor, id) {
    const companyId = toCompanyId(id);
    if (companyId === null) return { deleted: false };

    requireCompanyScope(actor, companyId);

    const deleted = await Company.findOneAndDelete({ company_id: companyId });
    return { deleted: Boolean(deleted) };
}

/**
 * Actualiza el logo de una empresa (requiere autenticación).
 *
 * Auth (frontend):
 * - Authorization: Bearer <token>
 *
 * Permisos:
 * - admin  : permitido
 * - company: solo su propia empresa (actor.company_id === company_id)
 *
 * Entrada (desde controller):
 * - fileBuffer: Buffer (archivo recibido por multipart/form-data)
 *
 * Persistencia (backend):
 * - data/company_logos/original/<company_id>.png
 * - data/company_logos/processed/<company_id>.png
 *
 * Respuesta:
 * - Company con logo_full_path
 *
 * Errores típicos:
 * - 400: archivo inválido
 * - 404: empresa no existe
 *
 * @param {any} actor
 * @param {string|number} companyIdRaw
 * @param {Buffer} fileBuffer
 * @returns {Promise<Object|null>}
 */
export async function updateCompanyLogoService(actor, companyIdRaw, fileBuffer) {
    const companyId = toCompanyId(companyIdRaw);
    if (companyId === null) return null;

    requireCompanyScope(actor, companyId);

    const company = await Company.findOne({ company_id: companyId }).lean();
    if (!company) return null;

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw httpError(400, "Invalid file");
    }

    const ROOT = process.cwd();
    const BASE_DIR = path.join(ROOT, "data", "company_logos");
    const ORIGINAL_DIR = path.join(BASE_DIR, "original");
    const PROCESSED_DIR = path.join(BASE_DIR, "processed");

    if (!fs.existsSync(ORIGINAL_DIR)) fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
    if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

    const fileName = `${companyId}.png`;
    const originalPath = path.join(ORIGINAL_DIR, fileName);

    await sharp(fileBuffer).png().toFile(originalPath);
    await standardizeLogo(originalPath, PROCESSED_DIR, DEFAULT_LOGO_SIZE, fileName);

    return attachLogoFullPath(company);
}
