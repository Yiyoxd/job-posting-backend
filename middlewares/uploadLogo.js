/**
 * uploadCompanyLogo.js — MIDDLEWARE PARA SUBIR LOGO (MEMORY, NO TEMP)
 *
 * Espera un multipart/form-data con:
 *   - field: "logo"
 *
 * NOTA:
 * - Aquí NO guardamos a disco.
 * - El guardado en original/processed lo hace el service para poder nombrar con company_id.
 */

import multer from "multer";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const ALLOWED_MIME = new Set([
    "image/png",
    "image/jpeg",
    "image/webp"
]);

export const uploadCompanyLogo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_LOGO_BYTES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        return cb(new Error("Formato de imagen no soportado (usa PNG/JPG/WEBP)"));
    }
}).single("logo");
