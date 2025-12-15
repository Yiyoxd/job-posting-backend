/**
 * ============================================================================
 * seedCompaniesIncremental.js
 * ============================================================================
 *
 * - NO borra datos
 * - NO resetea counters
 * - Respeta autoincremental
 * - Crea SOLO si no existe
 * - Usa logger del proyecto
 */

import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";

import User from "../models/User.js";
import Company from "../models/Company.js";

dotenv.config();

const {
    SEED_PASSWORD,
    SEED_COMPANY_COUNT
} = process.env;

async function run() {
    await connectDB();

    const password_hash = await bcrypt.hash(SEED_PASSWORD, 10);
    const count = Number(SEED_COMPANY_COUNT);

    logger.info(`Seeding ${count} empresas (incremental)`);

    for (let i = 0; i < count; i++) {
        const email = `company${i}@test.com`;

        // 🔎 ¿Ya existe el user?
        const existingUser = await User.findOne({ email }).lean();
        if (existingUser) {
            logger.info(`Company ${i} ya existe → skip`);
            continue;
        }

        // ✅ Crear empresa
        const company = await Company.create({
            name: `Company ${i}`,
            description: `Empresa de prueba ${i}`,
            country: "Mexico",
            state: "Coahuila",
            city: "Torreon",
            company_size_min: 10,
            company_size_max: 100
        });

        // ✅ Crear usuario ligado
        const user = await User.create({
            type: "company",
            email,
            password_hash,
            company_id: company.company_id
        });

        logger.success(
            `Company creada → company_id=${company.company_id}, user_id=${user.user_id}`
        );
    }

    logger.success("Seed incremental de empresas COMPLETADO");
    process.exit(0);
}

run().catch((err) => {
    logger.error(err);
    process.exit(1);
});
