/**
 * =============================================================================
 *  insertFullExport.js — IMPORTADOR PROFESIONAL + SINCRONIZACIÓN DE COUNTERS
 * =============================================================================
 *
 *  OBJETIVO
 *  --------
 *  Importar de forma segura y eficiente un archivo JSON que contiene:
 *
 *      {
 *          "companies": [...],
 *          "jobs": [...]
 *      }
 *
 *  y dejar el sistema en un estado CONSISTENTE para operación normal del backend.
 *
 *  Este script:
 *   ✔ Elimina SOLO las colecciones `companies` y `jobs`
 *   ✔ Inserta datos en LOTES (chunked inserts)
 *   ✔ Muestra barra de progreso real
 *   ✔ NO normaliza ni limpia datos (se asume JSON correcto)
 *   ✔ SINCRONIZA los contadores incrementales (`company_id`, `job_id`)
 *
 *  Al finalizar:
 *   - Los IDs incrementales quedan alineados con el MAX real en la BD
 *   - El backend puede seguir creando empresas y vacantes sin colisiones
 *
 * =============================================================================
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Modelos principales
import Company from "../models/Company.js";
import Job from "../models/Job.js";

// Modelo de contadores incrementales
import Counter from "../models/Counter.js";

// Infraestructura común
import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";
import { ProgressBar } from "../utils/progressBar.js";
import { createPromptFromArgs } from "../utils/prompt.js";

// =============================================================================
// CONFIGURACIÓN GENERAL
// =============================================================================

const prompt = createPromptFromArgs(process.argv);
const __dirname = path.resolve();

// Archivo de entrada (export previamente generado)
const FILE_PATH = path.join(__dirname, "data", "jobs.json");

// Tamaño de lote para inserciones masivas
// Ajustable según RAM / tamaño del dataset
const CHUNK_SIZE = 2000;

// =============================================================================
// LIMPIEZA CONTROLADA DE COLECCIONES
// =============================================================================

/**
 * Elimina ÚNICAMENTE las colecciones:
 *   - companies
 *   - jobs
 *
 * No toca:
 *   - users
 *   - applications
 *   - counters
 *   - ninguna otra colección
 */
async function limpiarColecciones() {
    logger.section("Eliminando colecciones objetivo");

    const confirmado = await prompt.confirm(
        "Esto ELIMINARÁ 'companies' y 'jobs'. ¿Continuar? (y/N): "
    );

    if (!confirmado) {
        logger.warn("Operación cancelada por el usuario.");
        process.exit(0);
    }

    const coleccionesObjetivo = ["companies", "jobs"];

    for (const nombre of coleccionesObjetivo) {
        const coleccion = mongoose.connection.collections[nombre];

        if (!coleccion) {
            logger.warn(`❗ La colección '${nombre}' no existe. Se omite.`);
            continue;
        }

        logger.info(`🧹 Eliminando colección '${nombre}'...`);

        await coleccion.drop().catch(err => {
            if (err.code === 26) {
                logger.warn(`(omitido) '${nombre}' no existía.`);
            } else {
                throw err;
            }
        });
    }

    logger.success("✔ Colecciones eliminadas correctamente.");
}

// =============================================================================
// CARGA Y VALIDACIÓN DEL EXPORT
// =============================================================================

/**
 * Carga el archivo JSON y valida su estructura mínima.
 *
 * NO valida contenido de campos (eso se asume correcto).
 */
function cargarExportacion() {
    if (!fs.existsSync(FILE_PATH)) {
        throw new Error(`❌ No se encontró el archivo: ${FILE_PATH}`);
    }

    const contenido = fs.readFileSync(FILE_PATH, "utf8");
    const json = JSON.parse(contenido);

    if (!json.companies || !json.jobs) {
        throw new Error(
            "❌ Formato inválido. Se esperaba: { companies: [...], jobs: [...] }"
        );
    }

    logger.success(
        `✔ Archivo cargado → Empresas: ${json.companies.length} | Trabajos: ${json.jobs.length}`
    );

    return json;
}

// =============================================================================
// INSERCIÓN EN LOTES (CHUNKED INSERTS)
// =============================================================================

/**
 * Inserta documentos en bloques para:
 *  - No saturar memoria
 *  - Mantener la app responsiva
 *  - Permitir progreso real
 */
async function insertChunked(Model, data, progress, insertados) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const slice = data.slice(i, i + CHUNK_SIZE);

        await Model.insertMany(slice);

        insertados.count += slice.length;
        progress.update(insertados.count);
    }
}

// =============================================================================
// SINCRONIZACIÓN DE CONTADORES INCREMENTALES
// =============================================================================

/**
 * Alinea los contadores (`Counter`) con el valor máximo real insertado.
 *
 * Esto es CRÍTICO para:
 *  - evitar colisiones de IDs
 *  - permitir POST normales después del import
 */
async function syncCounters() {
    logger.section("Sincronizando counters incrementales");

    // Máximo company_id real
    const maxCompany = await Company.findOne({})
        .sort({ company_id: -1 })
        .select({ company_id: 1 })
        .lean();

    // Máximo job_id real
    const maxJob = await Job.findOne({})
        .sort({ job_id: -1 })
        .select({ job_id: 1 })
        .lean();

    const companySeq = maxCompany?.company_id ?? 0;
    const jobSeq = maxJob?.job_id ?? 0;

    // Actualiza o crea los counters
    await Counter.updateOne(
        { _id: "company_id" },
        { $set: { seq: companySeq } },
        { upsert: true }
    );

    await Counter.updateOne(
        { _id: "job_id" },
        { $set: { seq: jobSeq } },
        { upsert: true }
    );

    logger.success(`✔ Counter company_id = ${companySeq}`);
    logger.success(`✔ Counter job_id     = ${jobSeq}`);
}

// =============================================================================
// FLUJO PRINCIPAL
// =============================================================================

async function insertarDatos() {
    await connectDB();
    await limpiarColecciones();

    const data = cargarExportacion();
    const totalItems = data.companies.length + data.jobs.length;

    logger.section("Insertando datos");
    const progress = new ProgressBar(totalItems);
    const insertados = { count: 0 };

    // Inserta empresas
    if (data.companies.length > 0) {
        await insertChunked(Company, data.companies, progress, insertados);
    }

    // Inserta trabajos
    if (data.jobs.length > 0) {
        await insertChunked(Job, data.jobs, progress, insertados);
    }

    progress.finish();

    // 🔥 PASO CLAVE: alinear incrementadores
    await syncCounters();

    logger.success("🎉 Importación completa y sistema consistente.");
    process.exit(0);
}

// =============================================================================
// EJECUCIÓN
// =============================================================================

insertarDatos().catch(err => {
    logger.error(`❌ Error durante la importación: ${err.message}`);
    process.exit(1);
});
