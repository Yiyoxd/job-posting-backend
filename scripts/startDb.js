// scripts/startDb.js
/**
 * Script orquestador para:
 *
 *  1. Eliminar (dropear) toda la base de datos.
 *  2. Importar el árbol de ubicaciones (país → estados → ciudades).
 *  3. Insertar los datos semilla desde dataset_jobs.json.
 *  4. Recrear todos los índices.
 *
 * Uso:
 *   node scripts/startDb.js
 */

import { spawn } from "child_process";
import path from "path";

import { logger } from "../utils/logger.js";

const __dirname = path.resolve();

/**
 * Ejecuta otro script Node.js como proceso hijo.
 *
 * - Hereda la salida estándar (stdio: inherit).
 * - Código 0  → éxito.
 * - Otro código → error.
 */
const executeScript = (scriptPath, args = []) =>
    new Promise((resolve, reject) => {
        const child = spawn("node", [scriptPath, ...args], {
            stdio: "inherit",
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(`Error al ejecutar: ${scriptPath} (código ${code})`)
                );
            }
        });
    });

const startDb = async () => {
    try {
        logger.info("🚀 Iniciando reset + seed + creación de índices de la base de datos");

        // Rutas de scripts del pipeline
        const deleteDbScript        = path.join(__dirname, "scripts", "deleteDb.js");
        const importLocationsScript = path.join(__dirname, "scripts", "importLocations.js");
        const insertDataScript      = path.join(__dirname, "scripts", "insertData.js");
        const createIdxScript       = path.join(__dirname, "scripts", "createIndexes.js");

        // -------------------------------------------------------------------
        // 1) ELIMINAR BD COMPLETA
        // -------------------------------------------------------------------
        logger.info("🧹 Eliminando base de datos completa...");
        await executeScript(deleteDbScript, ["--auto"]);
        logger.success("✔ Base de datos eliminada correctamente");

        // -------------------------------------------------------------------
        // 2) IMPORTAR LOCATIONS
        // -------------------------------------------------------------------
        logger.info("🌍 Importando árbol de ubicaciones (país → estados → ciudades)...");
        await executeScript(importLocationsScript, ["--auto"]);
        logger.success("✔ Ubicaciones importadas correctamente");

        // -------------------------------------------------------------------
        // 3) INSERTAR SEED DATA
        // -------------------------------------------------------------------
        logger.info("📦 Insertando datos semilla (jobs, companies, etc.)...");
        await executeScript(insertDataScript, ["--auto"]);
        logger.success("✔ Datos semilla insertados correctamente");

        // -------------------------------------------------------------------
        // 4) CREAR ÍNDICES
        // -------------------------------------------------------------------
        logger.info("📑 Creando índices de la base de datos...");
        await executeScript(createIdxScript);
        logger.success("✔ Índices creados correctamente");

        logger.success(
            "🎉 Base de datos inicializada por completo: reset, locations, seed e índices listos"
        );

        process.exit(0);

    } catch (err) {
        logger.error("❌ Error en startDb", {
            message: err.message,
            stack: err.stack,
        });
        process.exit(1);
    }
};

startDb();
