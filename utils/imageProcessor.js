import sharp from "sharp";
import path from "path";
import fs from "fs";

export const DEFAULT_LOGO_SIZE = 256;

/**
 * Standardizes an input logo into a square transparent PNG with maximum visual quality.
 *
 * - Preserva transparencia real (alpha)
 * - Mantiene proporción sin distorsión
 * - Evita suavizado agresivo en bordes
 * - No hace doble render innecesario
 *
 * @param {string} inputPath   Ruta de la imagen original
 * @param {string} outputDir   Carpeta de salida
 * @param {number} size        Tamaño final (size x size)
 * @param {string} outputName  Nombre final del archivo (opcional)
 *
 * @returns {string} outputPath
 */
export async function standardizeLogo(
    inputPath,
    outputDir,
    size = DEFAULT_LOGO_SIZE,
    outputName
) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Validación básica
    const metadata = await sharp(inputPath).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
        throw new Error(`Archivo inválido o no soportado: ${inputPath}`);
    }

    const baseName = path
        .parse(inputPath)
        .name
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const finalName = outputName ?? `${baseName}.png`;
    const outputPath = path.join(outputDir, finalName);

    if (fs.existsSync(outputPath)) {
        await fs.promises.unlink(outputPath);
    }

    await sharp(inputPath)
        // Fuerza canal alpha real (clave para PNGs limpios)
        .ensureAlpha()

        // Redimensiona sin distorsión y con canvas transparente
        .resize(size, size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },

            // Mejor balance para logos (menos blur que lanczos3)
            kernel: sharp.kernel.lanczos2
        })

        // PNG optimizado pero visualmente nítido
        .png({
            compressionLevel: 9,      // máximo sin afectar calidad
            adaptiveFiltering: false, // evita artefactos raros en bordes
            force: true
        })

        .toFile(outputPath);

    return outputPath;
}
