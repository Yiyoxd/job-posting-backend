// utils/serviceError.js

/**
 * ServiceError
 * ------------
 * Error tipado para la capa de servicios.
 *
 * El controller/middleware puede mapear:
 * - err.code      → código estable para el frontend
 * - err.httpStatus → status HTTP recomendado
 * - err.meta      → detalles opcionales (no sensibles)
 */
export class ServiceError extends Error {
    constructor(code, message, httpStatus = 400, meta = undefined) {
        super(message);
        this.name = "ServiceError";
        this.code = code;
        this.httpStatus = httpStatus;
        this.meta = meta;
    }
}
