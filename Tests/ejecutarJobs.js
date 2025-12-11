/**
 * ejecutarJobs.js
 *
 * Ejecuta una gran batería de pruebas contra /api/jobs
 * y guarda cada resultado en tests/outputs/jobs/.
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
        ? `${process.env.API_BASE_URL}/jobs`
        : "http://localhost:8000/api/jobs";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "outputs", "jobs");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

logger.section("MEGA SUITE /api/jobs");
logger.info(`API Base URL: ${API_BASE}`);
logger.info(`Output folder: ${OUTPUT_DIR}`);

/* ---------------------------------------------------------
 * LISTA MASIVA DE QUERIES
 * --------------------------------------------------------- */
const tests = [
    // Básicos
    { name: "all_jobs_page1", url: `${API_BASE}` },
    { name: "all_jobs_page2", url: `${API_BASE}?page=2` },
    { name: "all_jobs_100limit", url: `${API_BASE}?limit=100` },

    // Texto (ranking)
    { name: "python_developer", url: `${API_BASE}?q=python%20developer` },
    { name: "senior_backend_engineer", url: `${API_BASE}?q=senior%20backend%20engineer` },
    { name: "frontend_react", url: `${API_BASE}?q=frontend%20react` },
    { name: "software_engineer", url: `${API_BASE}?q=software%20engineer` },
    { name: "fullstack_node_react", url: `${API_BASE}?q=fullstack%20node%20react` },
    { name: "devops_engineer", url: `${API_BASE}?q=devops%20engineer` },
    { name: "data_scientist", url: `${API_BASE}?q=data%20scientist` },
    { name: "machine_learning_engineer", url: `${API_BASE}?q=machine%20learning%20engineer` },
    { name: "cloud_architect", url: `${API_BASE}?q=cloud%20architect` },
    { name: "security_engineer", url: `${API_BASE}?q=security%20engineer` },
    { name: "mobile_ios", url: `${API_BASE}?q=ios%20developer` },
    { name: "mobile_android", url: `${API_BASE}?q=android%20developer` },

    // Paginación
    { name: "senior_backend_page2_50", url: `${API_BASE}?q=senior%20backend%20engineer&page=2&limit=50` },
    { name: "python_page5", url: `${API_BASE}?q=python&page=5&limit=20` },

    // Ubicación
    { name: "usa_only", url: `${API_BASE}?country=United%20States` },
    { name: "canada_only", url: `${API_BASE}?country=Canada` },
    { name: "mexico_only", url: `${API_BASE}?country=Mexico` },
    { name: "usa_california", url: `${API_BASE}?country=United%20States&state=California` },
    { name: "usa_newyork", url: `${API_BASE}?country=United%20States&state=New%20York` },
    { name: "mexico_coahuila_torreon", url: `${API_BASE}?country=Mexico&state=Coahuila&city=Torreon` },
    { name: "uk_london", url: `${API_BASE}?country=United%20Kingdom&city=London` },

    // Modalidad
    { name: "onsite_only", url: `${API_BASE}?work_location_type=ONSITE` },
    { name: "hybrid_only", url: `${API_BASE}?work_location_type=HYBRID` },
    { name: "remote_only", url: `${API_BASE}?work_location_type=REMOTE` },
    { name: "remote_software_engineer", url: `${API_BASE}?q=software%20engineer&work_location_type=REMOTE` },
    { name: "remote_usa", url: `${API_BASE}?country=United%20States&work_location_type=REMOTE` },

    // Tipo de trabajo
    { name: "full_time", url: `${API_BASE}?work_type=FULL_TIME` },
    { name: "contract", url: `${API_BASE}?work_type=CONTRACT` },
    { name: "internship", url: `${API_BASE}?work_type=INTERNSHIP` },
    { name: "part_time", url: `${API_BASE}?work_type=PART_TIME` },

    // Rango salarial
    { name: "min_salary_100k", url: `${API_BASE}?min_salary=100000` },
    { name: "max_salary_80k", url: `${API_BASE}?max_salary=80000` },
    { name: "salary_range", url: `${API_BASE}?min_salary=50000&max_salary=150000` },
    { name: "normalized_range", url: `${API_BASE}?min_norm_salary=60000&max_norm_salary=200000` },

    // Fechas
    { name: "listed_from_2024", url: `${API_BASE}?listed_from=2024-01-01` },
    { name: "listed_2023_range", url: `${API_BASE}?listed_from=2023-01-01&listed_to=2023-12-31` },

    // Sorting
    { name: "sort_salary_asc", url: `${API_BASE}?sortBy=max_salary&sortDir=asc` },
    { name: "sort_salary_desc", url: `${API_BASE}?sortBy=max_salary&sortDir=desc` },
    { name: "sort_norm_salary", url: `${API_BASE}?sortBy=normalized_salary&sortDir=desc` },
    { name: "sort_date_asc", url: `${API_BASE}?sortBy=listed_time&sortDir=asc` },

    // Forzar regex (omite ranking)
    { name: "force_regex_sort_salary", url: `${API_BASE}?q=devops&sortBy=max_salary` },

    // Queries complejas
    {
        name: "multi_filter_1",
        url: `${API_BASE}?q=engineer&country=United%20States&work_type=FULL_TIME&work_location_type=ONSITE&min_salary=80000&sortBy=max_salary&sortDir=desc`
    },
    {
        name: "multi_filter_2",
        url: `${API_BASE}?q=data&country=Canada&work_location_type=HYBRID&max_salary=150000`
    },
    {
        name: "multi_filter_3",
        url: `${API_BASE}?q=software&country=Mexico&listed_from=2023-01-01&listed_to=2024-12-31&sortBy=listed_time&sortDir=desc`
    },
    {
        name: "multi_filter_4",
        url: `${API_BASE}?q=cloud&work_type=CONTRACT&min_norm_salary=100000&country=United%20States`
    },

    // Stress test (20)
    ...Array.from({ length: 20 }).map((_, i) => ({
        name: `stress_query_${i + 1}`,
        url: `${API_BASE}?q=engineer&page=${i + 1}&limit=20`
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
 * EJECUCION MASIVA
 * --------------------------------------------------------- */
async function runAll() {
    logger.section("Iniciando pruebas");

    for (const t of tests) {
        await runTest(t);
    }

    logger.section("Pruebas finalizadas");
}

runAll();
