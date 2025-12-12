/**
 * Standardizes all company logos in /data/company_logos/original/
 * into square PNG files located in /data/company_logos/processed/.
 *
 * - Usa logger para mensajes.
 * - Tamaño cuadrado configurable en LOGO_SIZE.
 * - Sobrescribe los archivos si ya existen.
 * - Nombre de salida basado en el nombre original (0.png, 2121.png, etc).
 */

import fs from "fs";
import path from "path";
import sharp from "sharp"; // por si quieres validar algo extra en el futuro

import { standardizeLogo, DEFAULT_LOGO_SIZE } from "../utils/imageProcessor.js";
import { logger } from "../utils/logger.js";

const __dirname = path.resolve();

// 🔧 Tamaño cuadrado de los logos (cámbialo aquí si quieres otro)
// También puedes usar process.env.LOGO_SIZE si después quieres hacerlo por env.
const LOGO_SIZE = DEFAULT_LOGO_SIZE;

const BASE = path.join(__dirname, "data", "company_logos");
const INPUT_DIR = path.join(BASE, "original");
const OUTPUT_DIR = path.join(BASE, "processed");

for (const dir of [BASE, INPUT_DIR, OUTPUT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const VALID_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;

/* Simple progress bar en consola */
const updateProgress = (current, total) => {
    const percent = ((current / total) * 100).toFixed(1);
    const width = Math.floor((percent / 100) * 30);
    const bar = "█".repeat(width) + "░".repeat(30 - width);
    process.stdout.write(`\r${bar} ${percent}%  (${current}/${total})`);
};

async function processAll() {
    logger.section("Standardizing company logos");

    const files = fs.readdirSync(INPUT_DIR);

    if (files.length === 0) {
        logger.warn("No images found in input directory.");
        return;
    }

    logger.info(`Input dir: ${INPUT_DIR}`);
    logger.info(`Output dir: ${OUTPUT_DIR}`);
    logger.info(`Target size: ${LOGO_SIZE}x${LOGO_SIZE}`);
    logger.info(`Total files detected: ${files.length}`);

    let processed = 0;
    let converted = 0;
    let skipped = 0;
    const total = files.length;

    for (const file of files) {
        const fullPath = path.join(INPUT_DIR, file);

        // No es imagen válida por extensión → solo avanzamos el progreso
        if (!VALID_EXT.test(file)) {
            skipped++;
            processed++;
            updateProgress(processed, total);
            continue;
        }

        // Validar que sea una imagen legible
        try {
            await sharp(fullPath).metadata();
        } catch {
            logger.warn(`Skipping invalid image: ${file}`);
            skipped++;
            processed++;
            updateProgress(processed, total);
            continue;
        }

        // Nombre base: respeta 0.png, 2121.png, etc
        const baseName = path.parse(file).name;
        const outputName = `${baseName}.png`;

        try {
            await standardizeLogo(fullPath, OUTPUT_DIR, LOGO_SIZE, outputName);
            converted++;
        } catch (err) {
            logger.error(`Error processing ${file}: ${err.message}`);
            skipped++;
        } finally {
            processed++;
            updateProgress(processed, total);
        }
    }

    process.stdout.write("\n");
    logger.success(
        `Processing completed. Converted: ${converted}, skipped: ${skipped}, total: ${total}`
    );
}

processAll().catch((err) => {
    logger.error(`Fatal error processing logos: ${err.message}`);
    process.exit(1);
});
