/**
 * ============================================================================
 * companyFeaturedService.js — Servicio de Empresas Destacadas
 * ============================================================================
 *
 * Público:
 * - listFeaturedCompaniesService({ limit? }) -> { meta, data }
 *
 * Admin:
 * - addFeaturedCompanyService({ company_id }) -> { status, company_id }
 * - removeFeaturedCompanyService(companyId)   -> { deleted }
 *
 * Rendimiento:
 * - 2 queries (FeaturedCompany + Companies por $in)
 * - lean() en ambas
 * - cache en memoria con invalidación al mutar
 * ============================================================================
 */

import FeaturedCompany from "../models/FeaturedCompany.js";
import Company from "../models/Company.js";

// Reutiliza tu lógica existente para "Company DTO + logo_full_path" (o lo que ya regreses).
// Ajusta el nombre al helper real que YA tienes en companyService.js.
import { attachLogoFullPath } from "./companyService.js";

/* =============================================================================
 * Errores tipados (compatibles con tu respondServiceError)
 * ============================================================================= */
function httpError(httpStatus, message) {
    const err = new Error(message);
    err.httpStatus = httpStatus;
    return err;
}

function parsePositiveInt(name, raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${name} debe ser un entero > 0`);
    return n;
}

/* =============================================================================
 * Cache (memoria)
 * ============================================================================= */
const cache = {
    exp: 0,
    key: "",
    value: null
};

function cacheKey(limit) {
    return `limit:${limit}`;
}

function invalidateCache() {
    cache.exp = 0;
    cache.key = "";
    cache.value = null;
}

/* =============================================================================
 * GET público: Featured Companies
 * ============================================================================= */
export async function listFeaturedCompaniesService(queryParams = {}) {
    const limit = Number(queryParams.limit) || 20;

    const key = cacheKey(limit);
    const now = Date.now();

    // TTL corto para Home; invalida al mutar en admin.
    if (cache.value && cache.key === key && cache.exp > now) {
        return cache.value;
    }

    const featuredRows = await FeaturedCompany.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select({ company_id: 1, _id: 0 })
        .lean();

    const ids = featuredRows.map((r) => r.company_id);

    if (!ids.length) {
        const empty = {
            meta: { page: 1, limit, total: 0, totalPages: 1 },
            data: []
        };
        cache.key = key;
        cache.value = empty;
        cache.exp = now + 30_000;
        return empty;
    }

    const companies = await Company.find({ company_id: { $in: ids } }).lean();

    // Mantener el orden de "featured" (createdAt DESC) sin rank
    const byId = new Map();
    for (const c of companies) byId.set(c.company_id, c);

    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    // Reusa tu lógica ya existente (no re-implementa logo_full_path)
    const data = ordered.map((c) => attachLogoFullPath(c));

    const result = {
        meta: { page: 1, limit, total: data.length, totalPages: 1 },
        data
    };

    cache.key = key;
    cache.value = result;
    cache.exp = now + 30_000;

    return result;
}

/* =============================================================================
 * POST admin: agregar destacada
 * ============================================================================= */
export async function addFeaturedCompanyService(payload = {}) {
    const company_id = parsePositiveInt("company_id", payload.company_id);

    const existsCompany = await Company.exists({ company_id });
    if (!existsCompany) throw httpError(404, "Empresa no encontrada");

    const already = await FeaturedCompany.findOne({ company_id }).lean();
    if (already) {
        return { status: "already_exists", company_id };
    }

    await FeaturedCompany.create({ company_id });

    invalidateCache();

    return { status: "created", company_id };
}

/* =============================================================================
 * DELETE admin: eliminar destacada
 * ============================================================================= */
export async function removeFeaturedCompanyService(companyId) {
    const company_id = parsePositiveInt("companyId", companyId);

    const out = await FeaturedCompany.deleteOne({ company_id });

    if (out.deletedCount > 0) {
        invalidateCache();
    }

    return { deleted: out.deletedCount > 0 };
}
