/**
 * ============================================================================
 *  jobRoutes.js — RUTAS DE EMPLEOS
 * ============================================================================
 *
 * Prefijo recomendado: /api/jobs
 *
 *   GET    /            → getJobs
 *   GET    /filters/options
 *                      → getJobFilterOptions
 *   GET    /company/:companyId
 *                      → getJobsByCompany
 *   GET    /:id        → getJobById
 *   POST   /           → createJob
 *   PUT    /:id        → updateJob
 *   DELETE /:id        → deleteJob
 *
 * IMPORTANTE:
 *   - Las rutas estáticas ("/filters/options" y "/company/:companyId")
 *     van antes de "/:id" para evitar conflictos en Express.
 * ============================================================================
 */

import express from "express";

import {
    getJobs,
    getJobById,
    getJobsByCompany,
    getJobFilterOptions,
    createJob,
    updateJob,
    deleteJob
} from "../controllers/jobController.js";

const router = express.Router();

// Listado principal con filtros, paginación y ordenamiento
router.get("/", getJobs);

// Opciones para filtros (distincts)
router.get("/filters/options", getJobFilterOptions);

// Empleos de una empresa específica (con mismos filtros que getJobs)
router.get("/company/:companyId", getJobsByCompany);

// Empleo por ID
router.get("/:id", getJobById);

// Crear nuevo empleo
router.post("/", createJob);

// Actualizar empleo existente
router.put("/:id", updateJob);

// Eliminar empleo
router.delete("/:id", deleteJob);

export default router;
