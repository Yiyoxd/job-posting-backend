/**
 * ejecutarLocations.js
 *
 * Ejecuta una batería de pruebas contra /api/locations
 * y guarda cada resultado en tests/outputs/locations/.
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

import { logger } from "../utils/logger.js";

dotenv.config();

/* ---------------------------------------------------------
 * CONFIG
 * --------------------------------------------------------- */
const API_BASE =
    process.env.API_BASE_URL
        ? `${process.env.API_BASE_URL}/locations`
        : "http://localhost:8000/api/locations";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "outputs", "locations");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

logger.section("MEGA SUITE /api/locations");
logger.info(`API Base URL: ${API_BASE}`);
logger.info(`Output folder: ${OUTPUT_DIR}`);

/* ---------------------------------------------------------
 * LISTA MASIVA DE QUERIES
 * --------------------------------------------------------- */
const tests = [
    // Países
    { name: "countries", url: `${API_BASE}/countries` },

    // Estados por país
    { name: "mexico_states", url: `${API_BASE}/Mexico/states` },
    { name: "usa_states", url: `${API_BASE}/United%20States/states` },
    { name: "canada_states", url: `${API_BASE}/Canada/states` },
    { name: "uk_states", url: `${API_BASE}/United%20Kingdom/states` },

    // Ciudades por estado
    { name: "mexico_coahuila_cities", url: `${API_BASE}/Mexico/Coahuila de Zaragoza/cities` },
    { name: "usa_california_cities", url: `${API_BASE}/United%20States/California/cities` },
    { name: "usa_newyork_cities", url: `${API_BASE}/United%20States/New%20York/cities` },

    // Buscador global
    { name: "search_mexico", url: `${API_BASE}/search?q=Mexico` },
    { name: "search_usa", url: `${API_BASE}/search?q=United%20States` },
    { name: "search_coahuila", url: `${API_BASE}/search?q=Coahuila` },
    { name: "search_torreon", url: `${API_BASE}/search?q=Torreon` },
    { name: "search_london", url: `${API_BASE}/search?q=London` },
    { name: "search_monterrey", url: `${API_BASE}/search?q=Monterrey` },
    { name: "search_newyork", url: `${API_BASE}/search?q=New%20York` },
    { name: "search_state_partial_coa", url: `${API_BASE}/search?q=coa` },
    { name: "search_city_partial_lon", url: `${API_BASE}/search?q=lon` },

    // TOP-K variando K
    { name: "search_toronto_top5", url: `${API_BASE}/search?q=Toronto&k=5` },
    { name: "search_mex_top10", url: `${API_BASE}/search?q=mex&k=10` },

    // Stress test
    ...Array.from({ length: 20 }).map((_, i) => ({
        name: `stress_location_${i + 1}`,
        url: `${API_BASE}/search?q=co&page=${i + 1}`
    }))
];

/* ---------------------------------------------------------
 * EJECUCIÓN INDIVIDUAL
 * --------------------------------------------------------- */
async function runTest(test) {
    logger.info(`Ejecutando: ${test.name}`);
    try {
        const res = await axios.get(test.url);

        const file = path.join(OUTPUT_DIR, `${test.name}.json`);
        fs.writeFileSync(file, JSON.stringify(res.data, null, 2));

        logger.success(`Guardado: ${file}`);
    } catch (err) {
        const file = path.join(OUTPUT_DIR, `${test.name}_ERROR.json`);
        fs.writeFileSync(
            file,
            JSON.stringify({ error: err.message }, null, 2)
        );

        logger.error(`Error en ${test.name}`);
        logger.warn(`Guardado error: ${file}`);
    }
}

/* ---------------------------------------------------------
 * EJECUCIÓN MASIVA
 * --------------------------------------------------------- */
async function runAll() {
    logger.section("Iniciando pruebas");

    for (const t of tests) {
        await runTest(t);
    }

    logger.section("Pruebas finalizadas");
}

runAll();
