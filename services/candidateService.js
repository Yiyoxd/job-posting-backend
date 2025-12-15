// services/candidateService.js

/**
 * ============================================================================
 * candidateService.js — Servicio de Candidatos
 * ============================================================================
 *
 * Acceso (actor autenticado, independiente de OAuth/JWT/sesión)
 * - actor = { type: "candidate"|"company"|"admin", candidate_id?, company_id? }
 *
 * Visibilidad del perfil
 * - Candidate (dueño) / Admin:
 *   - Puede ver y editar su perfil completo.
 *   - Puede obtener su CV (si existe).
 *
 * - Company:
 *   - Puede ver perfil de un candidato SOLO si existe al menos una postulación
 *     de ese candidato a esa empresa (Application: { candidate_id, company_id }).
 *   - Datos visibles: candidate_id, full_name, headline, ubicación, contact.
 *   - CV: se expone como URL protegida si existe el archivo.
 *
 * CV (archivo en disco)
 * - Ruta: data/cv/<candidate_id>.pdf
 * - El servicio NO sirve archivos estáticos sin control de acceso.
 * - La URL del CV se calcula como endpoint protegido:
 *   /api/candidates/<candidate_id>/cv
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
 * Define si una empresa puede ver el perfil de un candidato.
 * Regla: debe existir al menos una Application (candidate_id, company_id).
 */
async function companyCanViewCandidate(company_id, candidate_id) {
    const exists = await Application.exists({ company_id, candidate_id });
    return Boolean(exists);
}

/* =============================================================================
 * Helpers: CV (ruta, existencia, URL protegida)
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
 * Helpers: DTOs (salida para frontend)
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
 * Create
 * =============================================================================
 */

/**
 * createCandidateService
 * ----------------------
 * Crea un perfil de candidato.
 *
 * Acceso:
 * - Público (NO requiere autenticación).
 *
 * Comportamiento:
 * - Siempre crea un nuevo candidato.
 *
 * Retorna:
 * - { status: "created", candidate }
 */
export async function createCandidateService(payload) {
    const created = await Candidate.create({
        full_name: payload?.full_name,
        contact: payload?.contact,
        country: payload?.country,
        state: payload?.state,
        city: payload?.city,
        headline: payload?.headline
    });

    return {
        status: "created",
        candidate: toOwnerCandidateDTO(created.toObject())
    };
}


/* =============================================================================
 * Read
 * =============================================================================
 */

/**
 * getCandidateByIdService
 * -----------------------
 * Obtiene un candidato por candidate_id.
 *
 * Acceso:
 * - candidate: solo su propio perfil
 * - company: solo si existe relación por postulación (Application)
 * - admin: permitido
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
 * Actualiza campos del candidato con semántica PATCH (solo campos presentes).
 *
 * Acceso:
 * - candidate: solo su propio perfil
 * - admin: permitido
 *
 * Campos aceptados:
 * - full_name, contact, country, state, city, headline
 *
 * Retorna:
 * - { status:"ok", candidate }
 * - { status:"not_found" }
 */
export async function updateCandidateService(actor, candidate_id, payload = {}) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    requireSelfCandidateOrAdmin(actor, cid);

    const $set = {};
    if (payload.full_name !== undefined) $set.full_name = payload.full_name;
    if (payload.contact !== undefined) $set.contact = payload.contact;
    if (payload.country !== undefined) $set.country = payload.country;
    if (payload.state !== undefined) $set.state = payload.state;
    if (payload.city !== undefined) $set.city = payload.city;
    if (payload.headline !== undefined) $set.headline = payload.headline;

    const updated = await Candidate.findOneAndUpdate(
        { candidate_id: cid },
        Object.keys($set).length ? { $set } : {},
        { new: true }
    ).lean();

    if (!updated) return { status: "not_found" };

    return { status: "ok", candidate: toOwnerCandidateDTO(updated) };
}

/* =============================================================================
 * Company: listado de candidatos visibles por empresa
 * =============================================================================
 */

/**
 * listCandidatesForCompanyService
 * -------------------------------
 * Lista candidatos que han postulado a la empresa.
 *
 * Acceso:
 * - company: solo su propia company_id
 * - admin: permitido
 *
 * Respuesta:
 * - { status:"ok", total, page, limit, items }
 *   items[] contiene Candidate DTO (company view) + last_applied_at
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
 * CV: autorización y resolución de archivo (para endpoint protegido)
 * =============================================================================
 */

/**
 * resolveCandidateCvService
 * -------------------------
 * Resuelve el archivo de CV si el actor tiene permiso y el archivo existe.
 *
 * Acceso:
 * - candidate: solo su propio CV
 * - company: solo si existe relación por postulación (Application)
 * - admin: permitido
 *
 * Retorna:
 * - { status:"ok", file_path }
 * - { status:"not_found" }   (si no existe candidato)
 * - { status:"no_cv" }       (si no existe archivo)
 */
export async function resolveCandidateCvService(actor, candidate_id) {
    requireActor(actor);

    const cid = requirePositiveId("candidate_id", candidate_id);

    const candidate = await Candidate.findOne({ candidate_id: cid }).select({ candidate_id: 1 }).lean();
    if (!candidate) return { status: "not_found" };

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
