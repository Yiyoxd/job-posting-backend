    import sharp from "sharp";
    import path from "path";
    import fs from "fs";

    export const DEFAULT_LOGO_SIZE = 256;

    /**
     * Standardizes an input logo into a square transparent PNG of the given size.
     *
     * - inputPath: ruta de la imagen original
     * - outputDir: carpeta donde se guardará el PNG procesado
     * - size: lado del cuadrado (size x size). Por defecto DEFAULT_LOGO_SIZE
     * - outputName: nombre del archivo de salida (ej. "acme.png").
     *               Si no se pasa, se usa el nombre base del archivo original.
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

        // Valida que realmente sea una imagen
        await sharp(inputPath).metadata();

        // Si no nos dan nombre, usamos el nombre base del archivo original
        const baseName = path.parse(inputPath).name.replace(/[^a-zA-Z0-9_-]/g, "_");
        const finalName = outputName ?? `${baseName}.png`;
        const outputPath = path.join(outputDir, finalName);

        // Si ya existe, lo sobrescribimos (eliminar explícitamente para que quede limpio)
        if (fs.existsSync(outputPath)) {
            await fs.promises.unlink(outputPath);
        }

        // Redimensionamos manteniendo proporción y fondo transparente
        const resized = await sharp(inputPath)
            .resize(size, size, {
                fit: "contain",
                background: { r: 255, g: 255, b: 255, alpha: 0 },
            })
            .toBuffer();

        // Creamos un lienzo cuadrado transparente y centramos el logo
        await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 },
            },
        })
            .composite([{ input: resized, gravity: "center" }])
            .png()
            .toFile(outputPath);

        return outputPath;
    }
