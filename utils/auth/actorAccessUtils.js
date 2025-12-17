// utils/auth/actorAccessUtils.js

/**
 * ============================================================================
 * actorAccessUtils.js — Validación de acceso basada en "actor"
 * ============================================================================
 *
 * Este módulo define un contrato uniforme para autorización a nivel service.
 * El frontend NO envía "actor" directamente: el backend lo resuelve desde auth
 * (JWT/OAuth/Sesión) y lo inyecta como `req.actor`.
 *
 * Contrato mínimo esperado:
 *   actor = {
 *     type: "admin" | "company" | "candidate",
 *     company_id?: number
 *   }
 *
 * Convención de errores:
 * - Error con `httpStatus` se traduce a HTTP en el controller.
 *   401: no autenticado
 *   403: autenticado pero sin permisos
 *   409: conflicto (p. ej. ya existe perfil asociado)
 * ============================================================================
 */

/**
 * Crea un Error con httpStatus para que el controller lo traduzca a HTTP.
 * @param {number} httpStatus
 * @param {string} message
 */
export function httpError(httpStatus, message) {
    const err = new Error(message);
    err.httpStatus = httpStatus;
    return err;
}

/**
 * Requiere actor autenticado.
 * @param {any} actor
 * @returns {any}
 */
export function requireActor(actor) {
    if (!actor) throw httpError(401, "Authentication required");
    return actor;
}

/**
 * Requiere que el actor sea uno de los roles permitidos.
 * @param {any} actor
 * @param {Array<"admin"|"company"|"candidate">} allowed
 */
export function requireActorType(actor, allowed) {
    requireActor(actor);

    const type = actor?.type;
    if (!allowed.includes(type)) {
        throw httpError(403, "Not authorized");
    }
}

/**
 * Restringe acceso a un recurso "Company" por company_id.
 *
 * Regla:
 * - admin: acceso total
 * - company: solo si actor.company_id === company_id
 *
 * @param {any} actor
 * @param {number} companyId
 */
export function requireCompanyScope(actor, companyId) {
    requireActor(actor);

    if (actor.type === "admin") return;

    if (actor.type === "company") {
        const actorCompanyId = Number(actor.company_id);
        const targetCompanyId = Number(companyId);

        if (Number.isInteger(actorCompanyId) && actorCompanyId === targetCompanyId) return;
    }

    //console.log(actor, companyId)
    throw httpError(403, "Not authorized");
}
