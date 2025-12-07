/**
 * Procesa todos los logos de INPUT_DIR y genera versiones estandarizadas en OUTPUT_DIR.
 * Solo procesa archivos que sean imágenes válidas.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { estandarizarLogo } = require("../utils/imageProcessor");

const INPUT_DIR = path.join(__dirname, "..", "images/logos");
const OUTPUT_DIR = path.join(__dirname, "..", "images/logos200x200");

async function procesarTodos() {
    const archivos = fs.readdirSync(INPUT_DIR);

    for (const archivo of archivos) {
        const rutaCompleta = path.join(INPUT_DIR, archivo);

        // Solo aceptar extensiones de imagen
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(archivo)) {
            console.log("Saltando (no es imagen):", archivo);
            continue;
        }

        // Validar imagen antes de procesarla
        try {
            await sharp(rutaCompleta).metadata();
        } catch {
            console.log("Archivo inválido o corrupto:", archivo);
            continue;
        }

        // Procesar imagen
        try {
            const outPath = await estandarizarLogo(rutaCompleta, OUTPUT_DIR, 200);
            console.log("OK:", outPath);
        } catch (err) {
            console.log("Error procesando", archivo, "->", err.message);
        }
    }
}

procesarTodos();
