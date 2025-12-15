/**
 * ============================================================================
 * companyFeaturedController.js — Controlador HTTP de Empresas Destacadas
 * ============================================================================
 *
 * Público:
 * - GET /api/companies/featured
 *
 * Admin:
 * - POST   /api/companies/featured
 * - DELETE /api/companies/featured/:companyId
 * ============================================================================
 */

import {
    listFeaturedCompaniesService,
    addFeaturedCompanyService,
    removeFeaturedCompanyService
} from "../services/companyFeaturedService.js";

function respondServiceError(err, res, fallbackMessage) {
    const status = Number(err?.httpStatus);
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
        return res.status(status).json({ error: err.message || fallbackMessage });
    }
    return res.status(500).json({ error: fallbackMessage, details: err?.message });
}

/* =============================================================================
 * GET /api/companies/featured (público)
 * ============================================================================= */
export async function getFeaturedCompanies(req, res) {
    try {
        const result = await listFeaturedCompaniesService(req.query);
        return res.json(result);
    } catch (err) {
        return respondServiceError(err, res, "Error al obtener empresas destacadas");
    }
}

/* =============================================================================
 * POST /api/companies/featured (admin)
 * Body: { company_id: number }
 * ============================================================================= */
export async function addFeaturedCompany(req, res) {
    try {
        const result = await addFeaturedCompanyService(req.body);
        return res.status(result.status === "created" ? 201 : 200).json(result);
    } catch (err) {
        return respondServiceError(err, res, "Error al agregar empresa destacada");
    }
}

/* =============================================================================
 * DELETE /api/companies/featured/:companyId (admin)
 * ============================================================================= */
export async function deleteFeaturedCompany(req, res) {
    try {
        const result = await removeFeaturedCompanyService(req.params.companyId);
        if (!result.deleted) return res.status(404).json({ error: "Empresa destacada no encontrada" });
        return res.json({ message: "Empresa destacada eliminada correctamente" });
    } catch (err) {
        return respondServiceError(err, res, "Error al eliminar empresa destacada");
    }
}
