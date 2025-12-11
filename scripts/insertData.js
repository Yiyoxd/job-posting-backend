/**
 * =============================================================================
 *  insertFullExport.js  —  Importador Profesional
 * =============================================================================
 *
 *  ✔ Importa un archivo JSON que contiene:
 *        {
 *            "companies": [...],
 *            "jobs": [...]
 *        }
 *
 *  ✔ Elimina SOLO:
 *        - companies
 *        - jobs
 *
 *  ✔ Inserta usando "chunked inserts" para:
 *        - evitar bloquear el event loop
 *        - mejorar la barra de progreso
 *        - reducir riesgo de stack / RAM issues
 *
 *  ✔ Ya NO existe la colección employeeCounts.
 *
 *  ✔ Este import NO limpia ni normaliza datos: se asume que el JSON ya viene
 *    correctamente preparado.
 *
 * =============================================================================
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Company from "../models/Company.js";
import Job from "../models/Job.js";

import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";
import { ProgressBar } from "../utils/progressBar.js";
import { createPromptFromArgs } from "../utils/prompt.js";

// ---------------------------------------------------------
const prompt = createPromptFromArgs(process.argv);
const __dirname = path.resolve();

// Cambia tu archivo si usas otro
const FILE_PATH = path.join(__dirname, "data", "full_export2.json");

// Tamaño de lote para inserciones
const CHUNK_SIZE = 2000;
// ---------------------------------------------------------


/**
 * Elimina únicamente las colecciones objetivo.
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

        await coleccion.drop().catch((err) => {
            if (err.code === 26) {
                logger.warn(`(omitido) '${nombre}' no existía.`);
            } else {
                throw err;
            }
        });
    }

    logger.success("✔ Colecciones eliminadas correctamente.");
}


/**
 * Carga y valida el archivo JSON del export.
 */
function cargarExportacion() {
    if (!fs.existsSync(FILE_PATH)) {
        throw new Error(`❌ No se encontró el archivo: ${FILE_PATH}`);
    }

    const contenido = fs.readFileSync(FILE_PATH, "utf8");
    const json = JSON.parse(contenido);

    if (!json.companies || !json.jobs) {
        throw new Error(`❌ Formato inválido. Debe ser: { companies: [...], jobs: [...] }`);
    }

    logger.success(
        `✔ Archivo cargado → Empresas: ${json.companies.length} | Trabajos: ${json.jobs.length}`
    );

    return json;
}


/**
 * Inserta documentos en lotes (chunks) para mejor rendimiento.
 */
async function insertChunked(Model, data, progress, insertados) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const slice = data.slice(i, i + CHUNK_SIZE);
        await Model.insertMany(slice);

        insertados.count += slice.length;
        progress.update(insertados.count);
    }
}


/**
 * Inserta los datos completos en MongoDB.
 */
async function insertarDatos() {
    await connectDB();
    await limpiarColecciones();

    const data = cargarExportacion();
    const totalItems = data.companies.length + data.jobs.length;

    logger.section("Insertando datos");
    const progress = new ProgressBar(totalItems);

    const insertados = { count: 0 };

    // Empresas
    if (data.companies.length > 0) {
        await insertChunked(Company, data.companies, progress, insertados);
    }

    // Trabajos
    if (data.jobs.length > 0) {
        await insertChunked(Job, data.jobs, progress, insertados);
    }

    progress.finish();
    logger.success("🎉 Importación completada exitosamente.");

    process.exit(0);
}


// ---------------------------------------------------------
insertarDatos().catch(err => {
    logger.error(`❌ Error durante la importación: ${err.message}`);
    process.exit(1);
});
