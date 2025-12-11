// scripts/startDb.js
/**
 * Script orquestador para:
 *
 *  1. Eliminar (dropear) toda la base de datos.
 *  2. Importar el árbol de ubicaciones (país → estados → ciudades).
 *  3. Insertar los datos semilla desde dataset_jobs.json.
 *  4. Recrear todos los índices.
 *
 * Este archivo permite un flujo completo de:
 *    "resetear BD → reconstruir datos base → dejar índices listos"
 *
 * Uso:
 *   node scripts/startDb.js
 */

import { spawn } from "child_process";
import path from "path";

const __dirname = path.resolve();

/**
 * Ejecuta otro script Node.js como proceso hijo.
 *
 * - Hereda la salida estándar, por lo que los logs aparecen en la misma terminal.
 * - Si el script termina con código 0 → éxito.
 * - Si termina con otro código → se rechaza la promesa.
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
                reject(new Error(`Error al ejecutar: ${scriptPath} (código ${code})`));
            }
        });
    });

const startDb = async () => {
    try {
        console.log("\n🚀 Iniciando reset + seed + creación de índices de la base de datos...\n");

        // Rutas de scripts involucrados en el pipeline
        const deleteDbScript        = path.join(__dirname, "scripts", "deleteDb.js");
        const importLocationsScript = path.join(__dirname, "scripts", "importLocations.js");
        const insertDataScript      = path.join(__dirname, "scripts", "insertData.js");
        const createIdxScript       = path.join(__dirname, "scripts", "createIndexes.js");

        // -------------------------------------------------------------------
        // 1) ELIMINAR BD COMPLETA
        //    - Modo automático (--auto): sin preguntas
        // -------------------------------------------------------------------
        await executeScript(deleteDbScript, ["--auto"]);
        console.log("✔ Base de datos eliminada correctamente.\n");

        // -------------------------------------------------------------------
        // 2) IMPORTAR LOCATIONS (país → estados → ciudades)
        //
        //    ¿Qué hace importLocations.js?
        //       • Borra únicamente la colección 'locations'
        //       • Inserta el archivo data/locations.json como un árbol completo
        //
        //    ¿Por qué va aquí?
        //       • Debe existir ANTES de insertar los jobs y companies.
        //         (para que puedan relacionarse o resolverse correctamente)
        // -------------------------------------------------------------------
        await executeScript(importLocationsScript, ["--auto"]);
        console.log("✔ Ubicaciones importadas correctamente.\n");

        // -------------------------------------------------------------------
        // 3) INSERTAR SEED DATA (jobs, companies, employeeCounts, etc.)
        //    - Carga masiva desde dataset_jobs.json
        //    - Corre en modo automático
        // -------------------------------------------------------------------
        await executeScript(insertDataScript, ["--auto"]);
        console.log("✔ Datos semilla insertados.\n");

        // -------------------------------------------------------------------
        // 4) CREAR ÍNDICES
        //    - Genera todos los índices definidos en los modelos.
        // -------------------------------------------------------------------
        await executeScript(createIdxScript);
        console.log("✔ Índices creados correctamente.\n");

        console.log("\n🎉 Base de datos inicializada por completo: eliminada, locations importados, seed cargado, índices listos.\n");
        process.exit(0);

    } catch (err) {
        console.error("❌ Error en startDb:", err.message);
        process.exit(1);
    }
};

startDb();
