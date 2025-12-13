/**
 * createIndexes.js
 *
 * Crea SOLO los índices que NO están definidos en los modelos.
 * Esto evita conflictos con índices únicos o simples del schema.
 *
 * Índices creados:
 *   ✔ Jobs: title (texto)
 *   ✔ Jobs: ubicaciones (country, state, city)
 *   ✔ Jobs: rango salarial (min_salary, max_salary)
 *   ✔ Jobs: listed_time (fecha)
 *   Jobs : Company id
 *
 *   ✔ Companies: ubicación (country, state, city)
 *
 * Uso:
 *   node scripts/createIndexes.js
 */

import path from "path";
import { connectDB } from "../connection/db.js";

import Job from "../models/Job.js";
import Company from "../models/Company.js";

import { logger } from "../utils/logger.js";

const __dirname = path.resolve();

async function createIndex(collection, description, fields, options = {}, results = []) {
    const start = Date.now();
    try {
        await collection.createIndex(fields, options);
        const ms = Date.now() - start;
        logger.success(`${description} (${ms} ms)`);
        results.push({ description, status: "OK", time: ms });
    } catch (err) {
        logger.error(`${description} — ${err.message}`);
        results.push({ description, status: "ERROR" });
    }
}

async function createIndexes() {
    try {
        await connectDB();
        logger.section("Creando índices necesarios...");

        const results = [];

        // --------------------------------------------------
        // JOBS (solo índices avanzados)
        // --------------------------------------------------
        logger.info("Colección jobs:");

        await createIndex(
            Job.collection,
            "Índice de texto en título",
            { title: "text" },
            {},
            results
        );

        await createIndex(
            Job.collection,
            "Ubicación (country, state, city)",
            { country: 1, state: 1, city: 1 },
            {},
            results
        );

        await createIndex(
            Job.collection,
            "Rango salarial (min_salary, max_salary)",
            { min_salary: 1, max_salary: 1 },
            {},
            results
        );

        await createIndex(
            Job.collection,
            "listed_time (fecha)",
            { listed_time: -1 },
            {},
            results
        );

        await createIndex(
            Job.collection,
            "Jobs por empresa (company_id)",
            { company_id: 1 },
            {},
            results
        );

        // --------------------------------------------------
        // COMPANIES (solo índices avanzados)
        // --------------------------------------------------
        logger.info("Colección companies:");

        await createIndex(
            Company.collection,
            "Ubicación (country, state, city)",
            { country: 1, state: 1, city: 1 },
            {},
            results
        );

        logger.success("Índices creados exitosamente.");
        process.exit(0);

    } catch (error) {
        logger.error(`Error al crear índices: ${error.message}`);
        process.exit(1);
    }
}

createIndexes();
