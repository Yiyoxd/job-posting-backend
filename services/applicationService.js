// services/applicationService.js

/**
 * ============================================================================
 * applicationService.js — Servicio de Postulaciones (Application)
 * ============================================================================
 *
 * Identidad (actor)
 * - Este servicio NO depende del método de autenticación.
 * - Requiere un actor normalizado:
 *   { type: "candidate" | "company" | "admin", candidate_id?: number, company_id?: number }
 *
 * Modelo esperado (Application)
 * - application_id (number incremental)
 * - job_id (number)
 * - candidate_id (number)
 * - company_id (number)
 * - status (string)
 * - applied_at (date)
 * - updated_at (date)
 *
 * Visibilidad
 * - Candidate (dueño) / Admin:
 *   - Puede crear postulación, listar sus postulaciones, consultar detalle y retirar postulación.
 *
 * - Company / Admin:
 *   - Puede listar postulaciones de su empresa.
 *   - Puede ver candidato de una postulación SOLO cuando la postulación pertenece a su company_id.
 *   - Puede actualizar el status de una postulación SOLO cuando pertenece a su company_id.
 *
 * Datos de Job
 * - Este servicio NO incluye información del Job en respuestas.
 * - Solo se expone job_id.
 *
 * CV del candidato
 * - El CV no se guarda en Mongo.
 * - Se expone como URL protegida: /api/candidates/:candidate_id/cv
 * - El campo cv_url se calcula dinámicamente cuando se incluye candidato en respuestas.
 * ============================================================================
 */

import fs from "fs";
import path from "path";

import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Candidate from "../models/Candidate.js";

import { buildPaginationParams } from "../utils/paginationUtils.js";
import { addDateRangeFilter } from "../utils/mongoFilterUtils.js";
import { parseNumber, parseDate } from "../utils/parsingUtils.js";

/* =============================================================================
 * Constantes públicas
 * =============================================================================
 */
export const APPLICATION_STATUSES = Object.freeze([
    "APPLIED",
    "REVIEWING",
    "INTERVIEW",
    "OFFERED",
    "REJECTED",
    "HIRED"
]);

export const NOT_APPLIED = "NOT_APPLIED";

/* =============================================================================
 * Errores tipados (para que el controller responda consistente)
 * =============================================================================
 */
function makeError(code, httpStatus, message) {
    const err = new Error(message);
    err.code = code;
    err.httpStatus = httpStatus;
    return err;
}

/* =============================================================================
 * Actor y control de acceso
 * =============================================================================
 */
function requireActor(actor) {
    if (!actor || !actor.type) {
        throw makeError("unauthorized", 401, "Se requiere autenticación.");
    }
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

function requireApplicationOwnership(actor, application) {
    requireActor(actor);
    if (actor.type === "admin") return;

    if (actor.type === "candidate" && actor.candidate_id === application.candidate_id) return;
    if (actor.type === "company" && actor.company_id === application.company_id) return;

    throw makeError("forbidden", 403, "No autorizado para esta postulación.");
}

/* =============================================================================
 * Validación básica
 * =============================================================================
 */
function requirePositiveId(name, raw) {
    const n = parseNumber(raw);
    if (!n || n <= 0) throw makeError("invalid_params", 400, `${name} debe ser un número > 0.`);
    return n;
}

function normalizeStatus(raw) {
    if (raw === undefined || raw === null || raw === "") return null;
    const s = String(raw).trim().toUpperCase();
    return APPLICATION_STATUSES.includes(s) ? s : null;
}

function isDuplicateKeyError(err) {
    return err?.code === 11000 || /E11000 duplicate key/.test(String(err?.message || ""));
}

/* =============================================================================
 * CV (cálculo de URL protegida)
 * =============================================================================
 */
function getCvPath(candidate_id) {
    return path.resolve("data", "cv", `${candidate_id}.pdf`);
}
function getCvUrl(candidate_id) {
    return `/api/candidates/${candidate_id}/cv`;
}
function attachCvUrlToCandidateDTO(candidate) {
    const has = fs.existsSync(getCvPath(candidate.candidate_id));
    return {
        candidate_id: candidate.candidate_id,
        full_name: candidate.full_name,
        contact: candidate.contact,
        country: candidate.country ?? null,
        state: candidate.state ?? null,
        city: candidate.city ?? null,
        headline: candidate.headline ?? null,
        cv_url: has ? getCvUrl(candidate.candidate_id) : null
    };
}

/* =============================================================================
 * Filtros/paginación
 * =============================================================================
 */
function buildSort(queryParams = {}) {
    const allowed = new Set(["applied_at", "updated_at", "application_id", "status", "job_id", "candidate_id"]);
    const sortBy = allowed.has(String(queryParams.sortBy || "")) ? String(queryParams.sortBy) : "applied_at";
    const dir = String(queryParams.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;
    return { [sortBy]: dir, application_id: -1 };
}

function buildCandidateFilter(candidate_id, queryParams = {}) {
    const filter = { candidate_id };

    const st = normalizeStatus(queryParams.status);
    if (st) filter.status = st;

    addDateRangeFilter(filter, "applied_at", queryParams.from, queryParams.to);
    return filter;
}

function buildCompanyFilter(company_id, queryParams = {}) {
    const filter = { company_id };

    const jid = parseNumber(queryParams.job_id);
    if (jid && jid > 0) filter.job_id = jid;

    const st = normalizeStatus(queryParams.status);
    if (st) filter.status = st;

    addDateRangeFilter(filter, "applied_at", queryParams.from, queryParams.to);
    return filter;
}

/* =============================================================================
 * Create
 * =============================================================================
 */

/**
 * createApplicationService
 * Crea postulación (candidate_id, job_id).
 *
 * Acceso
 * - candidate: solo puede crear para su candidate_id
 * - admin: permitido
 *
 * Reglas
 * - company_id se deriva del Job
 * - Unicidad por (candidate_id, job_id)
 *
 * Respuestas
 * - { status:"created", application }
 * - { status:"already_exists", application }
 * - { status:"candidate_not_found" }
 * - { status:"job_not_found" }
 */
export async function createApplicationService(actor, { candidate_id, job_id }) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    const jid = requirePositiveId("job_id", job_id);

    requireSelfCandidateOrAdmin(actor, cid);

    const [candidateExists, job] = await Promise.all([
        Candidate.findOne({ candidate_id: cid }).select({ candidate_id: 1 }).lean(),
        Job.findOne({ job_id: jid }).select({ job_id: 1, company_id: 1 }).lean()
    ]);

    if (!candidateExists) return { status: "candidate_not_found" };
    if (!job) return { status: "job_not_found" };

    try {
        const created = await Application.create({
            candidate_id: cid,
            job_id: jid,
            company_id: job.company_id
        });

        return { status: "created", application: created.toObject() };
    } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;

        const existing = await Application.findOne({ candidate_id: cid, job_id: jid }).lean();
        return { status: "already_exists", application: existing };
    }
}

/* =============================================================================
 * Read
 * =============================================================================
 */

/**
 * getApplicationByIdService
 * Obtiene una postulación por application_id.
 *
 * Acceso
 * - candidate/company: solo si la postulación le pertenece
 * - admin: permitido
 *
 * Respuestas
 * - { status:"ok", application }
 * - { status:"not_found" }
 */
export async function getApplicationByIdService(actor, application_id) {
    const aid = requirePositiveId("application_id", application_id);

    const application = await Application.findOne({ application_id: aid }).lean();
    if (!application) return { status: "not_found" };

    requireApplicationOwnership(actor, application);
    return { status: "ok", application };
}

/**
 * getCompanyApplicationDetailService
 * Obtiene una postulación de una empresa e incluye datos visibles del candidato.
 *
 * Acceso
 * - company: solo si company_id coincide con la postulación
 * - admin: permitido
 *
 * Respuestas
 * - { status:"ok", application, candidate }
 * - { status:"not_found" }
 */
export async function getCompanyApplicationDetailService(actor, { company_id, application_id }) {
    const coid = requirePositiveId("company_id", company_id);
    const aid = requirePositiveId("application_id", application_id);

    requireSelfCompanyOrAdmin(actor, coid);

    const rows = await Application.aggregate([
        { $match: { company_id: coid, application_id: aid } },
        {
            $lookup: {
                from: "candidates",
                localField: "candidate_id",
                foreignField: "candidate_id",
                as: "candidate"
            }
        },
        { $unwind: { path: "$candidate", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                application: {
                    application_id: "$application_id",
                    job_id: "$job_id",
                    candidate_id: "$candidate_id",
                    company_id: "$company_id",
                    status: "$status",
                    applied_at: "$applied_at",
                    updated_at: "$updated_at"
                },
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
    ]);

    if (!rows || rows.length === 0) return { status: "not_found" };

    const row = rows[0];
    const candidate = row.candidate?.candidate_id ? attachCvUrlToCandidateDTO(row.candidate) : null;

    return { status: "ok", application: row.application, candidate };
}

/**
 * getApplicationStatusService
 * Regresa el status de (candidate_id, job_id) o NOT_APPLIED.
 *
 * Acceso
 * - candidate: solo su candidate_id
 * - admin: permitido
 *
 * Respuesta
 * - { status:"ok", application_status }
 */
export async function getApplicationStatusService(actor, { candidate_id, job_id }) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    const jid = requirePositiveId("job_id", job_id);

    requireSelfCandidateOrAdmin(actor, cid);

    const app = await Application.findOne({ candidate_id: cid, job_id: jid })
        .select({ status: 1 })
        .lean();

    return { status: "ok", application_status: app?.status ?? NOT_APPLIED };
}

/**
 * getStatusesForJobsService
 * Mapa job_id -> status para un candidato (NOT_APPLIED cuando no existe).
 *
 * Acceso
 * - candidate: solo su candidate_id
 * - admin: permitido
 *
 * Respuesta
 * - { status:"ok", map }
 */
export async function getStatusesForJobsService(actor, { candidate_id, job_ids }) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    requireSelfCandidateOrAdmin(actor, cid);

    if (!Array.isArray(job_ids) || job_ids.length === 0) return { status: "ok", map: {} };

    const ids = job_ids
        .map((x) => parseNumber(x))
        .filter((x) => Number.isFinite(x) && x > 0);

    if (ids.length === 0) return { status: "ok", map: {} };

    const apps = await Application.find({ candidate_id: cid, job_id: { $in: ids } })
        .select({ job_id: 1, status: 1 })
        .lean();

    const map = {};
    for (const id of ids) map[String(id)] = NOT_APPLIED;
    for (const a of apps) map[String(a.job_id)] = a.status;

    return { status: "ok", map };
}

/* =============================================================================
 * Lists
 * =============================================================================
 */

/**
 * listApplicationsByCandidateService
 * Lista postulaciones de un candidato.
 *
 * Acceso
 * - candidate: solo su candidate_id
 * - admin: permitido
 *
 * Query
 * - status?
 * - from? to? (applied_at)
 * - sortBy? sortDir?
 * - page? limit?
 *
 * Respuesta
 * - { status:"ok", total, page, limit, items }
 */
export async function listApplicationsByCandidateService(actor, candidate_id, queryParams = {}) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    requireSelfCandidateOrAdmin(actor, cid);

    const { page, limit, skip } = buildPaginationParams(queryParams);
    const filter = buildCandidateFilter(cid, queryParams);
    const sort = buildSort(queryParams);

    const [total, items] = await Promise.all([
        Application.countDocuments(filter),
        Application.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    return { status: "ok", total, page, limit, items };
}

/**
 * listApplicationsByCompanyService
 * Lista postulaciones de una empresa (sin incluir datos del candidato).
 *
 * Acceso
 * - company: solo su company_id
 * - admin: permitido
 *
 * Query
 * - job_id?
 * - status?
 * - from? to?
 * - sortBy? sortDir?
 * - page? limit?
 *
 * Respuesta
 * - { status:"ok", total, page, limit, items }
 */
export async function listApplicationsByCompanyService(actor, company_id, queryParams = {}) {
    const coid = requirePositiveId("company_id", company_id);
    requireSelfCompanyOrAdmin(actor, coid);

    const { page, limit, skip } = buildPaginationParams(queryParams);
    const filter = buildCompanyFilter(coid, queryParams);
    const sort = buildSort(queryParams);

    const [total, items] = await Promise.all([
        Application.countDocuments(filter),
        Application.find(filter).sort(sort).skip(skip).limit(limit).lean()
    ]);

    return { status: "ok", total, page, limit, items };
}

/**
 * listCompanyApplicationsWithCandidateService
 * Lista postulaciones de una empresa e incluye candidato visible + cv_url.
 *
 * Acceso
 * - company: solo su company_id
 * - admin: permitido
 *
 * Respuesta
 * - { status:"ok", total, page, limit, items }
 *   items[]:
 *   - application_id, job_id, candidate_id, company_id, status, applied_at, updated_at
 *   - candidate: { candidate_id, full_name, contact, country, state, city, headline, cv_url }
 */
export async function listCompanyApplicationsWithCandidateService(actor, company_id, queryParams = {}) {
    const coid = requirePositiveId("company_id", company_id);
    requireSelfCompanyOrAdmin(actor, coid);

    const { page, limit, skip } = buildPaginationParams(queryParams);
    const match = buildCompanyFilter(coid, queryParams);

    const out = await Application.aggregate([
        { $match: match },
        { $sort: { applied_at: -1, application_id: -1 } },
        {
            $facet: {
                meta: [{ $count: "total" }],
                items: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: "candidates",
                            localField: "candidate_id",
                            foreignField: "candidate_id",
                            as: "candidate"
                        }
                    },
                    { $unwind: { path: "$candidate", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 0,
                            application_id: 1,
                            job_id: 1,
                            candidate_id: 1,
                            company_id: 1,
                            status: 1,
                            applied_at: 1,
                            updated_at: 1,
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

    const total = out?.[0]?.total ?? 0;
    const rawItems = out?.[0]?.items ?? [];

    const items = rawItems.map((x) => ({
        ...x,
        candidate: x.candidate?.candidate_id ? attachCvUrlToCandidateDTO(x.candidate) : null
    }));

    return { status: "ok", total, page, limit, items };
}

/* =============================================================================
 * Update
 * =============================================================================
 */

/**
 * updateApplicationStatusService
 * Actualiza el status de una postulación.
 *
 * Acceso
 * - company: solo su company_id y solo sus postulaciones
 * - admin: permitido
 *
 * Respuestas
 * - { status:"ok", application }
 * - { status:"not_found" }
 * - { status:"invalid_status", allowed }
 */
export async function updateApplicationStatusService(actor, { company_id, application_id, status }) {
    const coid = requirePositiveId("company_id", company_id);
    const aid = requirePositiveId("application_id", application_id);
    requireSelfCompanyOrAdmin(actor, coid);

    const st = normalizeStatus(status);
    if (!st) return { status: "invalid_status", allowed: APPLICATION_STATUSES };

    const updated = await Application.findOneAndUpdate(
        { company_id: coid, application_id: aid },
        { $set: { status: st, updated_at: new Date() } },
        { new: true }
    ).lean();

    if (!updated) return { status: "not_found" };
    return { status: "ok", application: updated };
}

/* =============================================================================
 * Delete
 * =============================================================================
 */

/**
 * withdrawApplicationService
 * Retira una postulación (elimina el documento).
 *
 * Acceso
 * - candidate: solo su candidate_id
 * - admin: permitido
 *
 * Respuestas
 * - { status:"deleted" }
 * - { status:"not_found" }
 */
export async function withdrawApplicationService(actor, { candidate_id, job_id }) {
    const cid = requirePositiveId("candidate_id", candidate_id);
    const jid = requirePositiveId("job_id", job_id);

    requireSelfCandidateOrAdmin(actor, cid);

    const deleted = await Application.findOneAndDelete({ candidate_id: cid, job_id: jid }).lean();
    if (!deleted) return { status: "not_found" };

    return { status: "deleted" };
}

/* =============================================================================
 * Métricas
 * =============================================================================
 */

/**
 * getCompanyPipelineCountsService
 * Conteos por status para una empresa.
 *
 * Acceso
 * - company: solo su company_id
 * - admin: permitido
 *
 * Query/params
 * - job_id? (opcional)
 * - from? to? (applied_at)
 *
 * Respuesta
 * - { status:"ok", counts: [{ status, count }] }
 */
export async function getCompanyPipelineCountsService(actor, { company_id, job_id, from, to }) {
    const coid = requirePositiveId("company_id", company_id);
    requireSelfCompanyOrAdmin(actor, coid);

    const match = { company_id: coid };

    const jid = parseNumber(job_id);
    if (jid && jid > 0) match.job_id = jid;

    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (fromDate || toDate) {
        match.applied_at = {};
        if (fromDate) match.applied_at.$gte = fromDate;
        if (toDate) match.applied_at.$lte = toDate;
    }

    const counts = await Application.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
        { $sort: { count: -1 } }
    ]);

    return { status: "ok", counts };
}
