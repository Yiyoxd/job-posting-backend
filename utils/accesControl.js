// utils/accessControl.js

import { ServiceError } from "./serviceError.js";

/**
 * Actor (identidad ya autenticada)
 * -------------------------------
 * Estructura esperada (normalizada por middleware de auth):
 * - type: "candidate" | "company" | "admin"
 * - candidate_id?: number
 * - company_id?: number
 *
 * Esta capa no asume OAuth específico. Solo requiere un actor normalizado.
 */

export function requireActor(actor) {
    if (!actor || !actor.type) {
        throw new ServiceError("unauthorized", "Se requiere autenticación.", 401);
    }
}

export function requireCandidate(actor) {
    requireActor(actor);
    if (actor.type !== "candidate" && actor.type !== "admin") {
        throw new ServiceError("forbidden", "Acceso permitido solo a candidatos.", 403);
    }
}

export function requireCompany(actor) {
    requireActor(actor);
    if (actor.type !== "company" && actor.type !== "admin") {
        throw new ServiceError("forbidden", "Acceso permitido solo a empresas.", 403);
    }
}

export function requireSelfCandidate(actor, candidate_id) {
    requireCandidate(actor);
    if (actor.type === "admin") return;
    if (!actor.candidate_id || actor.candidate_id !== candidate_id) {
        throw new ServiceError("forbidden", "No autorizado para este candidato.", 403);
    }
}

export function requireSelfCompany(actor, company_id) {
    requireCompany(actor);
    if (actor.type === "admin") return;
    if (!actor.company_id || actor.company_id !== company_id) {
        throw new ServiceError("forbidden", "No autorizado para esta empresa.", 403);
    }
}

export function requireApplicationOwnership(actor, application) {
    requireActor(actor);
    if (actor.type === "admin") return;

    if (actor.type === "candidate") {
        if (!actor.candidate_id || actor.candidate_id !== application.candidate_id) {
            throw new ServiceError("forbidden", "No autorizado para esta postulación.", 403);
        }
        return;
    }

    if (actor.type === "company") {
        if (!actor.company_id || actor.company_id !== application.company_id) {
            throw new ServiceError("forbidden", "No autorizado para esta postulación.", 403);
        }
        return;
    }

    throw new ServiceError("forbidden", "No autorizado.", 403);
}
