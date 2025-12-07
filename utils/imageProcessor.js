/**
 * Procesa y estandariza un logo a un tamaño cuadrado (PNG con transparencia).
 * Valida que el archivo sea una imagen real antes de procesarlo.
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const SIZE = 200;

async function estandarizarLogo(inputPath, outputDir, size = SIZE) {
    // Crear carpeta de salida si no existe
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Validar que el archivo sea una imagen real
    try {
        await sharp(inputPath).metadata();
    } catch {
        throw new Error("Archivo no válido o imagen corrupta.");
    }

    const outputName = `logo_${Date.now()}.png`;
    const outputPath = path.join(outputDir, outputName);

    // Crear un canvas cuadrado transparente y centrar el logo redimensionado
    await sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
    })
        .composite([
            {
                input: await sharp(inputPath)
                    .resize(size, size, {
                        fit: "contain",
                        background: { r: 255, g: 255, b: 255, alpha: 0 }
                    })
                    .toBuffer(),
                gravity: "center"
            }
        ])
        .png()
        .toFile(outputPath);

    return outputPath;
}

module.exports = { estandarizarLogo };
