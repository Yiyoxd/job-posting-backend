/**
 * Standardizes all company logos in /data/company_logos/original/
 * into 200x200 PNG files located in /data/company_logos/processed/.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { standardizeLogo } from "../utils/imageProcessor.js";

const __dirname = path.resolve();

const BASE = path.join(__dirname, "data", "company_logos");
const INPUT_DIR = path.join(BASE, "original");
const OUTPUT_DIR = path.join(BASE, "processed");

for (const dir of [BASE, INPUT_DIR, OUTPUT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const VALID_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;

/* Simple progress bar */
const updateProgress = (current, total) => {
    const percent = ((current / total) * 100).toFixed(1);
    const width = Math.floor((percent / 100) * 30);
    const bar = "█".repeat(width) + "░".repeat(30 - width);
    process.stdout.write(`\r${bar} ${percent}%  (${current}/${total})`);
};

async function processAll() {
    const files = fs.readdirSync(INPUT_DIR);

    if (files.length === 0) {
        console.log("No images found.");
        return;
    }

    console.log("Processing logos...");
    let processed = 0;
    const total = files.length;

    for (const file of files) {
        const fullPath = path.join(INPUT_DIR, file);

        if (!VALID_EXT.test(file)) {
            processed++;
            updateProgress(processed, total);
            continue;
        }

        try {
            await sharp(fullPath).metadata();
        } catch {
            processed++;
            updateProgress(processed, total);
            continue;
        }

        const baseName = path.parse(file).name.replace(/[^a-zA-Z0-9_-]/g, "_");
        const outputName = `${baseName}_${Date.now()}.png`;

        try {
            await standardizeLogo(fullPath, OUTPUT_DIR, 200, outputName);
        } finally {
            processed++;
            updateProgress(processed, total);
        }
    }

    console.log("\nProcessing completed.");
}

processAll();
