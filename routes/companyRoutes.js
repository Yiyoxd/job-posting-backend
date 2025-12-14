/**
 * companyRoutes.js — RUTAS DE EMPRESAS
 */

import express from "express";

import {
    getCompanies,
    getCompanyById,
    getCompanyJobs,
    createCompany,
    updateCompany,
    deleteCompany,
    updateCompanyLogo
} from "../controllers/companyController.js";

import { uploadCompanyLogo } from "../middlewares/uploadLogo.js";

const router = express.Router();

// Listado principal con filtros
router.get("/", getCompanies);

// NUEVO: Actualizar logo (multipart/form-data)
router.put("/:id/logo", uploadCompanyLogo, updateCompanyLogo);

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
