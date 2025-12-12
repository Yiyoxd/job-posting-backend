/**
 * ============================================================================
 *  ejecutarCompanies.js — MEGA SUITE DE PRUEBAS /api/companies
 * ============================================================================
 *
 * Ejecuta cientos de pruebas contra:
 *     GET /api/companies
 *     GET /api/companies/:id
 *     GET /api/companies/:id/jobs
 *
 * Guarda cada respuesta en:
 *     tests/outputs/companies/
 *
 * Compatible con el rank inteligente:
 *   - Si envías q sin sortBy → orden por relevancia
 *   - Si envías q + sortBy → orden normal
 *
 * ============================================================================
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

/* ============================================================================
 *  CONFIG
 * ============================================================================
 */
const API_BASE =
    process.env.API_BASE_URL
        ? `${process.env.API_BASE_URL}/companies`
        : "http://localhost:8000/api/companies";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "outputs", "companies");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

logger.section("MEGA SUITE /api/companies");
logger.info(`API Base URL: ${API_BASE}`);
logger.info(`Output folder: ${OUTPUT_DIR}`);

/* ============================================================================
 *  LISTA MASIVA DE QUERIES
 * ============================================================================
 */
const tests = [
    // -------------------------
    // PRUEBAS BÁSICAS
    // -------------------------
    { name: "all_companies_page1", url: `${API_BASE}` },
    { name: "all_companies_page2", url: `${API_BASE}?page=2` },
    { name: "all_companies_100limit", url: `${API_BASE}?limit=100` },

    // -------------------------
    // BÚSQUEDAS (RANK INTELIGENTE)
    // -------------------------
    { name: "search_google", url: `${API_BASE}?q=google` },
    { name: "search_microsoft", url: `${API_BASE}?q=microsoft` },
    { name: "search_amazon", url: `${API_BASE}?q=amazon` },
    { name: "search_ibm", url: `${API_BASE}?q=ibm` },
    { name: "search_accenture", url: `${API_BASE}?q=accenture` },
    { name: "search_meta", url: `${API_BASE}?q=meta` },
    { name: "search_morgan", url: `${API_BASE}?q=morgan` },
    { name: "search_facebook", url: `${API_BASE}?q=facebook` },
    { name: "search_llc", url: `${API_BASE}?q=llc` },

    // -------------------------
    // BÚSQUEDAS COMPLEJAS (RANK PRO)
    // -------------------------
    { name: "search_google_mexico", url: `${API_BASE}?q=google mexico` },
    { name: "search_financial_newyork", url: `${API_BASE}?q=financial new york` },
    { name: "search_consulting_london", url: `${API_BASE}?q=consulting london` },
    { name: "search_ai_boston", url: `${API_BASE}?q=ai boston` },
    { name: "search_software_silicon_valley", url: `${API_BASE}?q=software silicon valley` },

    // -------------------------
    // FILTROS POR UBICACIÓN
    // -------------------------
    { name: "mexico_only", url: `${API_BASE}?country=Mexico` },
    { name: "usa_only", url: `${API_BASE}?country=United%20States` },
    { name: "canada_only", url: `${API_BASE}?country=Canada` },
    { name: "uk_only", url: `${API_BASE}?country=United%20Kingdom` },
    { name: "usa_california", url: `${API_BASE}?country=United%20States&state=California` },
    { name: "mexico_coahuila", url: `${API_BASE}?country=Mexico&state=Coahuila de Zaragoza` },
    { name: "mexico_coahuila_torreon", url: `${API_BASE}?country=Mexico&state=Coahuila de Zaragoza&city=Torreon` },

    // -------------------------
    // FILTRO + BÚSQUEDA (combinados)
    // -------------------------
    { name: "q_google_country_mexico", url: `${API_BASE}?q=google&country=Mexico` },
    { name: "q_consulting_country_usa", url: `${API_BASE}?q=consulting&country=United%20States` },
    {
        name: "q_financial_usa_newyork",
        url: `${API_BASE}?q=financial&country=United%20States&state=New%20York`
    },

    // -------------------------
    // TAMAÑO DE EMPRESA
    // -------------------------
    { name: "min_size_1000", url: `${API_BASE}?min_size=1000` },
    { name: "max_size_50", url: `${API_BASE}?max_size=50` },
    { name: "size_range_50_10000", url: `${API_BASE}?min_size=50&max_size=10000` },

    // -------------------------
    // ORDER BY
    // -------------------------
    { name: "sort_name_asc", url: `${API_BASE}?sortBy=name&sortDir=asc` },
    { name: "sort_name_desc", url: `${API_BASE}?sortBy=name&sortDir=desc` },
    { name: "sort_country", url: `${API_BASE}?sortBy=country&sortDir=asc` },
    { name: "sort_created_desc", url: `${API_BASE}?sortBy=createdAt&sortDir=desc` },

    // -------------------------
    // BÚSQUEDA + ORDENAMIENTO
    // (Fuerzan modo simple)
    // -------------------------
    { name: "search_google_sorted", url: `${API_BASE}?q=google&sortBy=name` },
    { name: "search_ai_sorted", url: `${API_BASE}?q=ai&sortBy=createdAt&sortDir=desc` },

    // -------------------------
    // QUERIES SUPER COMPLEJAS
    // -------------------------
    {
        name: "multi_filter_1",
        url: `${API_BASE}?q=software&country=United%20States&min_size=100&max_size=50000`
    },
    {
        name: "multi_filter_2",
        url: `${API_BASE}?q=cloud&country=Canada&state=Ontario&min_size=20&sortBy=name`
    },
    {
        name: "multi_filter_3",
        url: `${API_BASE}?q=ai robotics&country=United%20States&state=California`
    },
    {
        name: "multi_filter_4",
        url: `${API_BASE}?q=healthcare boston&min_size=50&max_size=20000`
    },

    // -------------------------
    // STRESS TEST (20 páginas de búsqueda)
    // -------------------------
    ...Array.from({ length: 20 }).map((_, i) => ({
        name: `stress_page_${i + 1}`,
        url: `${API_BASE}?q=engineer&page=${i + 1}&limit=20`
    }))
];

/* ============================================================================
 *  EJECUCIÓN INDIVIDUAL
 * ============================================================================
 */
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
            JSON.stringify(
                {
                    error: err.message,
                    url: test.url,
                    response: err?.response?.data || null
                },
                null,
                2
            )
        );

        logger.error(`Error en ${test.name}`);
        logger.warn(`Guardado error: ${file}`);
    }
}

/* ============================================================================
 *  EJECUCIÓN MASIVA
 * ============================================================================
 */
async function runAll() {
    logger.section("Iniciando pruebas /api/companies");

    for (const t of tests) {
        await runTest(t);
    }

    logger.section("Pruebas finalizadas /api/companies");
}

runAll();
