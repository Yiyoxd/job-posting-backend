import { logger } from "../utils/logger.js";

/**
 * Middleware global de manejo de errores
 * --------------------------------------------------
 * Captura cualquier error no manejado en la app
 */
export function errorHandler(err, req, res, next) {
    logger.error(err);

    // Si ya se envió respuesta, delega a Express
    if (res.headersSent) {
        return next(err);
    }

    // Status por defecto
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: err.code || "INTERNAL_ERROR",
        message: err.publicMessage || "Error inesperado del servidor",
    });
}
