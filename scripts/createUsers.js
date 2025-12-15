/**
 * ============================================================================
 * seedUsersIncremental.js
 * ============================================================================
 *
 * - NO borra datos
 * - NO resetea counters
 * - Idempotente por email (si existe → skip)
 *
 * Companies/Candidates:
 * - Usa registerService (mismo flujo que /api/auth/register)
 *
 * Admins:
 * - Tu registerService no acepta type="admin", así que se crean directo aquí.
 *
 * Requiere .env:
 * - SEED_PASSWORD
 * - SEED_ADMIN_COUNT
 * - SEED_COMPANY_COUNT
 * - SEED_CANDIDATE_COUNT
 * ============================================================================
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";

import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";

import User from "../models/User.js";
import { registerService } from "../services/authService.js";

const {
    SEED_PASSWORD,
    SEED_ADMIN_COUNT,
    SEED_COMPANY_COUNT,
    SEED_CANDIDATE_COUNT
} = process.env;

/* =============================================================================
 * Helpers
 * ============================================================================= */

function requireEnv(name, value) {
    if (!value) throw new Error(`${name} no está definido en el entorno`);
}

async function userExists(email) {
    const u = await User.findOne({ email }).lean();
    return Boolean(u);
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function logServiceError(err, context = {}) {
    logger.error(`Error: ${err?.message || "UNKNOWN_ERROR"}`);
    if (err?.publicMessage) logger.error(`Detalle: ${err.publicMessage}`);
    if (Object.keys(context).length) logger.error(`Contexto: ${JSON.stringify(context, null, 2)}`);
}

/* =============================================================================
 * Seed Admins (directo)
 * ============================================================================= */

async function seedAdmins(count) {
    logger.info(`Seeding ${count} admins`);

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const password_hash = await bcrypt.hash(String(SEED_PASSWORD), saltRounds);

    for (let i = 0; i < count; i++) {
        const email = normalizeEmail(`admin${i}@test.com`);

        if (await userExists(email)) {
            logger.info(`Admin ${i} ya existe → skip`);
            continue;
        }

        const user = await User.create({
            type: "admin",
            email,
            password_hash,
            company_id: null,
            candidate_id: null
        });

        logger.success(`Admin creado → user_id=${user.user_id}, email=${email}`);
    }
}

/* =============================================================================
 * Seed Companies (registerService)
 * ============================================================================= */

async function seedCompanies(count) {
    logger.info(`Seeding ${count} companies`);

    for (let i = 0; i < count; i++) {
        const email = normalizeEmail(`company${i}@test.com`);

        if (await userExists(email)) {
            logger.info(`Company ${i} ya existe → skip`);
            continue;
        }

        try {
            const { actor } = await registerService({
                type: "company",
                email,
                password: String(SEED_PASSWORD),
                company: {
                    name: `Company ${i}`,
                    description: `Empresa de prueba ${i}`,
                    country: "Mexico",
                    state: "Coahuila de Zaragoza",
                    city: "Torreon",
                    address: "Dirección de prueba",
                    company_size_min: 10,
                    company_size_max: 100
                }
            });

            logger.success(`Company creada → user_id=${actor.user_id}, company_id=${actor.company_id}`);
        } catch (err) {
            logServiceError(err, { step: "seedCompanies", i, email });
            throw err; // fail-fast (para que no se esconda el problema)
        }
    }
}

/* =============================================================================
 * Seed Candidates (registerService)
 * ============================================================================= */

async function seedCandidates(count) {
    logger.info(`Seeding ${count} candidates`);

    for (let i = 0; i < count; i++) {
        const email = normalizeEmail(`candidate${i}@test.com`);

        if (await userExists(email)) {
            logger.info(`Candidate ${i} ya existe → skip`);
            continue;
        }

        try {
            const { actor } = await registerService({
                type: "candidate",
                email,
                password: String(SEED_PASSWORD),
                candidate: {
                    full_name: `Candidate ${i}`,
                    contact: {
                        email, // opcional, tu registerService también lo completa si falta
                        phone: `87100000${String(i).padStart(2, "0")}`
                    },
                    country: "Mexico",
                    state: "Coahuila de Zaragoza",
                    city: "Torreon",
                    headline: "Software Engineer"
                }
            });

            logger.success(`Candidate creado → user_id=${actor.user_id}, candidate_id=${actor.candidate_id}`);
        } catch (err) {
            logServiceError(err, { step: "seedCandidates", i, email });
            throw err; // fail-fast
        }
    }
}

/* =============================================================================
 * Run
 * ============================================================================= */

async function run() {
    await connectDB();

    requireEnv("SEED_PASSWORD", SEED_PASSWORD);

    const adminCount = Number(SEED_ADMIN_COUNT || 0);
    const companyCount = Number(SEED_COMPANY_COUNT || 0);
    const candidateCount = Number(SEED_CANDIDATE_COUNT || 0);

    logger.info("=== INICIO SEED USUARIOS ===");

    if (adminCount > 0) await seedAdmins(adminCount);
    if (companyCount > 0) await seedCompanies(companyCount);
    if (candidateCount > 0) await seedCandidates(candidateCount);

    logger.success("=== SEED COMPLETADO ===");
    process.exit(0);
}

run().catch((err) => {
    logger.error(err);
    process.exit(1);
});
