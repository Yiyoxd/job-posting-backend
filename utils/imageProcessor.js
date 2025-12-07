import sharp from "sharp";
import path from "path";
import fs from "fs";

const DEFAULT_SIZE = 200;

/**
 * Standardizes an input logo into a square transparent PNG of the given size.
 */
export async function standardizeLogo(inputPath, outputDir, size = DEFAULT_SIZE, outputName) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Validate the file is a real image
    await sharp(inputPath).metadata();

    const finalName = outputName ?? `logo_${Date.now()}.png`;
    const outputPath = path.join(outputDir, finalName);

    const resized = await sharp(inputPath)
        .resize(size, size, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toBuffer();

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
