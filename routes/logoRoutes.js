/**
 * logoRoutes.js
 *
 * Rutas para servir logos de empresas.
 *
 * Expone:
 *  - GET /company_logos/processed/:file
 *
 * Comportamiento:
 *  - Devuelve el logo procesado si existe
 *  - Si no existe, devuelve DEFAULT_LOGO.png
 *  - Solo permite archivos .png
 */

import fs from "fs";
import express from "express";
import path from "path";

const router = express.Router();
const __dirname = path.resolve();

/* -------------------------------------------------------------------------- */
/*                               Configuración                                 */
/* -------------------------------------------------------------------------- */
const LOGOS_BASE_DIR = path.join(__dirname, "data", "company_logos");
const LOGOS_PROCESSED_DIR = path.join(LOGOS_BASE_DIR, "processed");
const DEFAULT_LOGO_FILE = "DEFAULT_LOGO.png";

/* -------------------------------------------------------------------------- */
/*                       GET logo procesado con fallback                       */
/* -------------------------------------------------------------------------- */
router.get("/processed/:file", (req, res) => {
    // Sanitiza el nombre para evitar path traversal
    const file = path.basename(req.params.file || "");

    // Contrato actual: solo se sirven archivos PNG
    if (!file.toLowerCase().endsWith(".png")) {
        return res.status(400).json({
            error: "Invalid file type. Only PNG allowed."
        });
    }

    const processedPath = path.join(LOGOS_PROCESSED_DIR, file);
    const fallbackPath = path.join(LOGOS_PROCESSED_DIR, DEFAULT_LOGO_FILE);

    if (fs.existsSync(processedPath)) {
        return res.sendFile(processedPath);
    }

    if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
    }

    return res.status(404).json({
        error: "Logo not found"
    });
});

export default router;
