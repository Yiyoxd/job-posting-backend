// services/authService.js

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Company from "../models/Company.js";
import Candidate from "../models/Candidate.js";

/* =============================================================================
 * JWT helpers
 * ============================================================================= */

function requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET_NOT_CONFIGURED");
    }
    return secret;
}

function signToken(actor) {
    const secret = requireJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    return jwt.sign(actor, secret, { expiresIn });
}

function buildActorFromUser(userDoc) {
    return {
        user_id: userDoc.user_id,
        type: userDoc.type,
        company_id: userDoc.company_id ?? null,
        candidate_id: userDoc.candidate_id ?? null,
    };
}

/* =============================================================================
 * Validación
 * ============================================================================= */

function badRequest(publicMessage) {
    const err = new Error("BAD_REQUEST");
    err.publicMessage = publicMessage;
    return err;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

/* =============================================================================
 * loginService
 * ============================================================================= */

/**
 * loginService
 * -----------------------------------------------------------------------------
 * Valida credenciales y genera token.
 *
 * Entrada:
 * - { email, password }
 *
 * Salida:
 * - { token, actor }
 *
 * Errores:
 * - BAD_REQUEST: faltan campos
 * - INVALID_CREDENTIALS: email/password incorrectos
 * - JWT_SECRET_NOT_CONFIGURED: falta JWT_SECRET
 */
export async function loginService({ email, password }) {
    const e = normalizeEmail(email);
    const p = String(password || "");

    if (!e || !p) {
        throw badRequest("email y password son obligatorios");
    }

    const user = await User.findOne({ email: e });
    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const ok = await bcrypt.compare(p, user.password_hash);
    if (!ok) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const actor = buildActorFromUser(user);
    const token = signToken(actor);

    return { token, actor };
}

/* =============================================================================
 * registerService
 * ============================================================================= */

/**
 * registerService
 * -----------------------------------------------------------------------------
 * Registra una cuenta y crea el perfil asociado (company/candidate).
 *
 * Entrada:
 * - type: "candidate" | "company" (admin no se recomienda registrar desde aquí)
 * - email: string
 * - password: string
 * - company?: payload para Company si type = "company"
 * - candidate?: payload para Candidate si type = "candidate"
 *
 * Comportamiento:
 * - Crea User con password_hash.
 * - Si type="company": crea Company (company_id autoincremental) y enlaza user.company_id.
 * - Si type="candidate": crea Candidate (candidate_id autoincremental) y enlaza user.candidate_id.
 *
 * Nota práctica:
 * - Candidate.contact.email es obligatorio en tu modelo. Si no lo mandas, se
 *   completa automáticamente con el email del User.
 *
 * Salida:
 * - { token, actor }
 *
 * Errores:
 * - BAD_REQUEST: faltan campos / type inválido / falta payload de perfil
 * - EMAIL_ALREADY_EXISTS: email ya registrado
 * - JWT_SECRET_NOT_CONFIGURED: falta JWT_SECRET
 */
export async function registerService({ type, email, password, company, candidate }) {
    const t = String(type || "").trim();
    const e = normalizeEmail(email);
    const p = String(password || "");

    if (!t || !e || !p) {
        throw badRequest("type, email y password son obligatorios");
    }

    if (!["company", "candidate"].includes(t)) {
        throw badRequest("type debe ser 'company' o 'candidate'");
    }

    const exists = await User.findOne({ email: e });
    if (exists) {
        throw new Error("EMAIL_ALREADY_EXISTS");
    }

    // Hash de password
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const password_hash = await bcrypt.hash(p, saltRounds);

    let userCreated = null;

    try {
        // 1) Crear User
        userCreated = await User.create({
            type: t,
            email: e,
            password_hash,
            company_id: null,
            candidate_id: null,
        });

        // 2) Crear perfil según type y enlazar
        if (t === "company") {
            if (!company || !company.name) {
                throw badRequest("company.name es obligatorio para registrar una empresa");
            }

            const companyDoc = await Company.create(company);

            userCreated.company_id = companyDoc.company_id;
            await userCreated.save();
        }

        if (t === "candidate") {
            if (!candidate || !candidate.full_name) {
                throw badRequest("candidate.full_name es obligatorio para registrar un candidato");
            }

            // Candidate.contact.email es obligatorio en tu modelo.
            // Si el frontend no lo manda, se setea al email del User.
            const candidatePayload = {
                ...candidate,
                contact: {
                    ...(candidate.contact || {}),
                    email: normalizeEmail(candidate?.contact?.email) || e,
                },
            };

            const candidateDoc = await Candidate.create(candidatePayload);

            userCreated.candidate_id = candidateDoc.candidate_id;
            await userCreated.save();
        }

        // 3) Token con actor completo (ya con company_id/candidate_id)
        const actor = buildActorFromUser(userCreated);
        const token = signToken(actor);

        return { token, actor };
    } catch (err) {
        // Limpieza básica: si se creó User pero falló el perfil, elimina User para no dejar basura.
        if (userCreated?.user_id != null) {
            await User.deleteOne({ user_id: userCreated.user_id });
        }
        throw err;
    }
}
