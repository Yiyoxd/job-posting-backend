/**
 * ============================================================================
 *  companyRoutes.js — RUTAS DE EMPRESAS
 * ============================================================================
 *
 * Prefijo recomendado: /api/companies
 *
 *   GET    /                 → getCompanies
 *   GET    /filters/options  → getCompanyFilterOptions
 *   GET    /:id/jobs         → getCompanyJobs
 *   GET    /:id              → getCompanyById
 *   POST   /                 → createCompany
 *   PUT    /:id              → updateCompany
 *   DELETE /:id              → deleteCompany
 *
 * Orden IMPORTANTE:
 *   - "/filters/options" y "/:id/jobs" van antes de "/:id".
 *     Esto evita que Express confunda ":id" con "filters" o "jobs".
 * ============================================================================
 */

import express from "express";

import {
    getCompanies,
    getCompanyById,
    getCompanyJobs,
    getCompanyFilterOptions,
    createCompany,
    updateCompany,
    deleteCompany,
} from "../controllers/companyController.js";

const router = express.Router();

// Listado principal con filtros
router.get("/", getCompanies);

// Opciones para filtros del frontend (countries, states, cities)
router.get("/filters/options", getCompanyFilterOptions);

// Empleos de una empresa (con filtros y paginación)
router.get("/:id/jobs", getCompanyJobs);

// Detalle de una empresa por ID
router.get("/:id", getCompanyById);

// Crear nueva empresa
router.post("/", createCompany);

// Actualizar empresa existente
router.put("/:id", updateCompany);

// Eliminar empresa
router.delete("/:id", deleteCompany);

export default router;
