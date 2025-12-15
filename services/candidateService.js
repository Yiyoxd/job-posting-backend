// services/candidateService.js

/**
 * ============================================================================
 * candidateService.js — Servicio de Candidatos
 * ============================================================================
 *
 * IMPORTANTE (flujo de tu sistema):
 * - Candidate se crea en /api/auth/register cuando type="candidate".
 * - Este servicio NO expone creación de candidato por POST /api/candidates.
 *
 * actor:
 * - { user_id, type: "candidate"|"company"|"admin", candidate_id?, company_id? }
 *
 * Visibilidad:
 * - Candidate (dueño) / Admin:
 *   - ver y editar perfil completo
 *   - resolver CV si existe
 *
 * - Company:
 *   - puede ver candidato SOLO si existe Application (candidate_id, company_id)
 *   - puede resolver CV bajo la misma regla
 *
 * CV:
 * - Archivo: data/cv/<candidate_id>.pdf
 * - URL protegida: /api/candidates/<candidate_id>/cv
 * ============================================================================
 */

import fs from "fs";
import path from "path";

import Candidate from "../models/Candidate.js";
import Application from "../models/Application.js";

import { parseNumber } from "../utils/parsingUtils.js";
import { buildPaginationParams } from "../utils/paginationUtils.js";

/* =============================================================================
 * Helpers: errores tipados
 * =============================================================================
 */
function makeError(code, httpStatus, message) {
    const err = new Error(message);
    err.code = code;
    err.httpStatus = httpStatus;
    return err;
}

/* =============================================================================
 * Helpers: actor y permisos
 * =============================================================================
 */
function requireActor(actor) {
    if (!actor || !actor.type) {
        throw makeError("unauthorized", 401, "Se requiere autenticación.");
    }
}

function requirePositiveId(name, raw) {
    const n = parseNumber(raw);
    if (!n || n <= 0) {
        throw makeError("invalid_params", 400, `${name} debe ser un número > 0.`);
    }
    return n;
}

function requireSelfCandidateOrAdmin(actor, candidate_id) {
    requireActor(actor);
    if (actor.type === "admin") return;

    if (actor.type !== "candidate" || actor.candidate_id !== candidate_id) {
        throw makeError("forbidden", 403, "No autorizado para este candidato.");
    }
}

function requireSelfCompanyOrAdmin(actor, company_id) {
    requireActor(actor);
    if (actor.type === "admin") return;

    if (actor.type !== "company" || actor.company_id !== company_id) {
        throw makeError("forbidden", 403, "No autorizado para esta empresa.");
    }
}

/**
 * Regla: company puede ver candidate si existe al menos una postulación.
 */
async function companyCanViewCandidate(company_id, candidate_id) {
    const exists = await Application.exists({ company_id, candidate_id });
    return Boolean(exists);
}

/* =============================================================================
 * Helpers: CV
 * =============================================================================
 */
function getCvPath(candidate_id) {
    return path.resolve("data", "cv", `${candidate_id}.pdf`);
}

function getCvUrl(candidate_id) {
    return `/api/candidates/${candidate_id}/cv`;
}

function hasCvFile(candidate_id) {
    return fs.existsSync(getCvPath(candidate_id));
}

/* =============================================================================
 * Helpers: DTOs
 * =============================================================================
 */
function toOwnerCandidateDTO(candidate) {
    return {
        candidate_id: candidate.candidate_id,
        full_name: candidate.full_name,
        contact: candidate.contact,
        country: candidate.country ?? null,
        state: candidate.state ?? null,
        city: candidate.city ?? null,
        headline: candidate.headline ?? null,
        created_at: candidate.created_at ?? null,
        cv_url: hasCvFile(candidate.candidate_id) ? getCvUrl(candidate.candidate_id) : null
    };
}

function toCompanyCandidateDTO(candidate) {
    return {
        candidate_id: candidate.candidate_id,
        full_name: candidate.full_name,
        contact: candidate.contact,
        country: candidate.country ?? null,
        state: candidate.state ?? null,
        city: candidate.city ?? null,
        headline: candidate.headline ?? null,
        cv_url: hasCvFile(candidate.candidate_id) ? getCvUrl(candidate.candidate_id) : null
    };
}

/* =============================================================================
 * Read
 * =============================================================================
 */

/**
 * getCandidateByIdService
 * -----------------------
 * Acceso:
 * - admin: permitido
 * - candidate: solo su propio perfil
 * - company: solo si existe Application (candidate_id, company_id)
 *
 * Retorna:
 * - { status:"ok", candidate }
 * - { status:"not_found" }
 */
export async function getCandidateByIdService(actor, candidate_id) {
    requireActor(actor);

    const cid = requirePositiveId("candidate_id", candidate_id);
    const candidate = await Candidate.findOne({ candidate_id: cid }).lean();
    if (!candidate) return { status: "not_found" };

    if (actor.type === "admin") {
        return { status: "ok", candidate: toOwnerCandidateDTO(candidate) };
    }

    if (actor.type === "candidate") {
        requireSelfCandidateOrAdmin(actor, cid);
        return { status: "ok", candidate: toOwnerCandidateDTO(candidate) };
    }

    if (actor.type === "company") {
        if (!actor.company_id) throw makeError("forbidden", 403, "Empresa no válida.");
        const allowed = await companyCanViewCandidate(actor.company_id, cid);
        if (!allowed) throw makeError("forbidden", 403, "No autorizado para ver este candidato.");
        return { status: "ok", candidate: toCompanyCandidateDTO(candidate) };
    }

    throw makeError("forbidden", 403, "No autorizado.");
}

/* =============================================================================
 * Update (PATCH)
 * =============================================================================
 */

/**
 * updateCandidateService
 * ----------------------
 * PATCH semántico (solo campos presentes).
 *
 * Acceso:
 * - candidate: solo su propio perfil
 * - admin: permitido
 *
 * Manejo seguro de contact:
 * - Si payload.contact viene parcial, se hace merge con el contact actual
 *   para no borrar contact.email (requerido por el schema).
 */
export async function updateCandidateService(actor, candidate_id, payload = {}) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    requireSelfCandidateOrAdmin(actor, cid);

    const current = await Candidate.findOne({ candidate_id: cid }).lean();
    if (!current) return { status: "not_found" };

    const $set = {};

    if (payload.full_name !== undefined) $set.full_name = payload.full_name;
    if (payload.country !== undefined) $set.country = payload.country;
    if (payload.state !== undefined) $set.state = payload.state;
    if (payload.city !== undefined) $set.city = payload.city;
    if (payload.headline !== undefined) $set.headline = payload.headline;

    if (payload.contact !== undefined) {
        if (!payload.contact || typeof payload.contact !== "object") {
            throw makeError("invalid_payload", 400, "contact debe ser un objeto.");
        }

        const merged = {
            ...(current.contact || {}),
            ...payload.contact
        };

        if (!merged.email) {
            throw makeError("invalid_payload", 400, "contact.email no puede quedar vacío.");
        }

        $set.contact = merged;
    }

    // Si no hay cambios, devuelve el actual
    if (Object.keys($set).length === 0) {
        return { status: "ok", candidate: toOwnerCandidateDTO(current) };
    }

    const updated = await Candidate.findOneAndUpdate(
        { candidate_id: cid },
        { $set },
        { new: true }
    ).lean();

    if (!updated) return { status: "not_found" };

    return { status: "ok", candidate: toOwnerCandidateDTO(updated) };
}

/* =============================================================================
 * Company: listado de candidatos por empresa
 * =============================================================================
 */

export async function listCandidatesForCompanyService(actor, company_id, queryParams = {}) {
    const coid = requirePositiveId("company_id", company_id);
    requireSelfCompanyOrAdmin(actor, coid);

    const { page, limit, skip } = buildPaginationParams(queryParams);

    const agg = await Application.aggregate([
        { $match: { company_id: coid } },
        { $group: { _id: "$candidate_id", last_applied_at: { $max: "$applied_at" } } },
        { $sort: { last_applied_at: -1, _id: -1 } },
        {
            $facet: {
                meta: [{ $count: "total" }],
                items: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: "candidates",
                            localField: "_id",
                            foreignField: "candidate_id",
                            as: "candidate"
                        }
                    },
                    { $unwind: { path: "$candidate", preserveNullAndEmptyArrays: false } },
                    {
                        $project: {
                            _id: 0,
                            last_applied_at: 1,
                            candidate: {
                                candidate_id: "$candidate.candidate_id",
                                full_name: "$candidate.full_name",
                                contact: "$candidate.contact",
                                country: "$candidate.country",
                                state: "$candidate.state",
                                city: "$candidate.city",
                                headline: "$candidate.headline"
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                total: { $ifNull: [{ $arrayElemAt: ["$meta.total", 0] }, 0] },
                items: 1
            }
        }
    ]);

    const total = agg?.[0]?.total ?? 0;
    const rawItems = agg?.[0]?.items ?? [];

    const items = rawItems.map((row) => ({
        last_applied_at: row.last_applied_at,
        candidate: {
            ...row.candidate,
            cv_url: hasCvFile(row.candidate.candidate_id) ? getCvUrl(row.candidate.candidate_id) : null
        }
    }));

    return { status: "ok", total, page, limit, items };
}

/* =============================================================================
 * CV: autorización y resolución de archivo
 * =============================================================================
 */

export async function resolveCandidateCvService(actor, candidate_id) {
    requireActor(actor);

    const cid = requirePositiveId("candidate_id", candidate_id);

    const existsCandidate = await Candidate.exists({ candidate_id: cid });
    if (!existsCandidate) return { status: "not_found" };

    if (actor.type === "admin") {
        const p = getCvPath(cid);
        if (!fs.existsSync(p)) return { status: "no_cv" };
        return { status: "ok", file_path: p };
    }

    if (actor.type === "candidate") {
        requireSelfCandidateOrAdmin(actor, cid);
        const p = getCvPath(cid);
        if (!fs.existsSync(p)) return { status: "no_cv" };
        return { status: "ok", file_path: p };
    }

    if (actor.type === "company") {
        if (!actor.company_id) throw makeError("forbidden", 403, "Empresa no válida.");
        const allowed = await companyCanViewCandidate(actor.company_id, cid);
        if (!allowed) throw makeError("forbidden", 403, "No autorizado para ver el CV de este candidato.");
        const p = getCvPath(cid);
        if (!fs.existsSync(p)) return { status: "no_cv" };
        return { status: "ok", file_path: p };
    }

    throw makeError("forbidden", 403, "No autorizado.");
}
