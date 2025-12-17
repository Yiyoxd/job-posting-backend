/**
 * uploadCv.js
 * -----------------------------------------------------------------------------
 * Middleware Multer para subida de CVs.
 *
 * Reglas:
 * - Solo archivos PDF
 * - Tamaño máximo: 5MB
 * - Guarda temporalmente en /uploads/tmp
 * -----------------------------------------------------------------------------
 */

import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: "uploads/tmp",
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});

function fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") {
        return cb(new Error("Solo se permiten archivos PDF"));
    }
    cb(null, true);
}

export const uploadCv = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});
