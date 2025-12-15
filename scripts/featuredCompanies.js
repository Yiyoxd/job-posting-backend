/**
 * ============================================================================
 * seedFeaturedCompanies.js
 * ============================================================================
 *
 * - Registra empresas TOP como destacadas (FeaturedCompany)
 * - NO borra datos existentes
 * - NO duplica registros
 * - Respeta company_id existentes
 * - Pensado para Home (Empresas destacadas)
 * ============================================================================
 */

import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";

import Company from "../models/Company.js";
import FeaturedCompany from "../models/FeaturedCompany.js";

/* =============================================================================
 * IDS DE EMPRESAS TOP
 * =============================================================================
 */
const TOP_COMPANY_IDS = [
    { id: 817, name: "VISA" },
    { id: 415, name: "Google" },
    { id: 317, name: "Amazon" },
    { id: 319, name: "Amazon Web Services" },
    { id: 342, name: "Tesla" },
    { id: 189, name: "Microsoft" },
    { id: 747, name: "Meta" },
    { id: 1076, name: "Netflix" },
    { id: 1077, name: "OpenAI" },
    { id: 1078, name: "Citadel" },
    { id: 1079, name: "NVIDIA" },
    { id: 1080, name: "Bloomberg" }
];

/* =============================================================================
 * RUN
 * =============================================================================
 */
async function run() {
    await connectDB();

    logger.info("=== INICIO SEED FEATURED COMPANIES ===");

    for (const item of TOP_COMPANY_IDS) {
        const { id, name } = item;

        // 1) Verificar que la empresa exista
        const existsCompany = await Company.exists({ company_id: id });
        if (!existsCompany) {
            //logger.warn(`Empresa NO encontrada → ${name} (${id})`);
            continue;
        }

        // 2) Evitar duplicados
        const alreadyFeatured = await FeaturedCompany.exists({ company_id: id });
        if (alreadyFeatured) {
            //logger.info(`Ya destacada → ${name} (${id})`);
            continue;
        }

        // 3) Insertar como destacada
        await FeaturedCompany.create({ company_id: id });
        //logger.success(`Destacada agregada → ${name} (${id})`);
    }

    logger.success("=== SEED FEATURED COMPANIES COMPLETADO ===");
    process.exit(0);
}

run().catch((err) => {
    logger.error(err);
    process.exit(1);
});
