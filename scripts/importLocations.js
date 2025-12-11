/**
 * importLocations.js — Importador TREE (país → estados → ciudades)
 *
 * Este script:
 *   ✔ Lee el archivo exportado: ./export/locations.json
 *   ✔ Borra SOLAMENTE la colección "locations"
 *   ✔ Inserta 1 documento por país con su árbol completo
 *
 * Formato esperado:
 *
 * {
 *   "locations": [
 *     {
 *       "country": "Mexico",
 *       "states": [
 *         { "state": "Coahuila", "cities": ["Torreón"] },
 *         { "state": "Jalisco",  "cities": ["Guadalajara"] }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import { connectDB } from "../connection/db.js";
import Location from "../models/Location.js";
import { logger } from "../utils/logger.js";
import { createPromptFromArgs } from "../utils/prompt.js";

const prompt = createPromptFromArgs(process.argv);
const DATA_PATH = path.resolve("./data/locations.json");

// ------------------------------------------------------------
// 1) Cargar archivo JSON
// ------------------------------------------------------------
function loadTree() {
    logger.section("Cargando locations.json…");

    if (!fs.existsSync(DATA_PATH)) {
        logger.error(`No existe el archivo: ${DATA_PATH}`);
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(DATA_PATH, "utf8");
        const json = JSON.parse(raw);

        if (!Array.isArray(json.locations)) {
            logger.error("El archivo no contiene el arreglo 'locations'.");
            process.exit(1);
        }

        logger.success(`Países cargados: ${json.locations.length}`);
        return json.locations;

    } catch (err) {
        logger.error("Error leyendo locations.json");
        logger.error(err.message);
        process.exit(1);
    }
}

// ------------------------------------------------------------
// 2) Borrar únicamente la colección locations
// ------------------------------------------------------------
async function clearCollection() {
    logger.section("Eliminando colección 'locations'…");

    try {
        await Location.collection.drop();
        logger.success("Colección 'locations' eliminada.");
    } catch (err) {
        if (err.code === 26) {
            logger.warn("La colección no existía. Se creará nueva.");
        } else {
            throw err;
        }
    }
}

// ------------------------------------------------------------
// 3) Insertar el árbol tal cual
// ------------------------------------------------------------
async function insertTree(tree) {
    logger.section("Insertando países…");

    await Location.insertMany(tree);

    logger.success("Importación completada.");
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
    logger.section("IMPORTADOR DE LOCATIONS");

    await connectDB();
    const tree = loadTree();

    const ok = await prompt.confirm(
        "Esto borrará SOLO la colección 'locations'. ¿Continuar? (y/N): "
    );

    if (!ok) {
        logger.warn("Cancelado por el usuario.");
        process.exit(0);
    }

    await clearCollection();
    await insertTree(tree);

    logger.section("FINALIZADO");
    logger.success("La colección 'locations' fue recreada con estructura.");
    process.exit(0);
}

main();
