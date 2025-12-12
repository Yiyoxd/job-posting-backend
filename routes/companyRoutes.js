/**
 * companyRoutes.js — RUTAS DE EMPRESAS
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

// Opciones para filtros del frontend
router.get("/filters/options", getCompanyFilterOptions);

// Empleos de una empresa
router.get("/:id/jobs", getCompanyJobs);

// Detalle de empresa
router.get("/:id", getCompanyById);

// Crear nueva empresa
router.post("/", createCompany);

// Actualizar empresa
router.put("/:id", updateCompany);

// Eliminar empresa
router.delete("/:id", deleteCompany);

export default router;
