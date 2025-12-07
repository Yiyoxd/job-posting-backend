import { spawn } from "child_process";
import path from "path";

const __dirname = path.resolve();

const ejecutarScript = (ruta, args = []) =>
    new Promise((resolve, reject) => {
        const proceso = spawn("node", [ruta, ...args], { stdio: "inherit" });

        proceso.on("close", (code) => {
            code === 0 ? resolve() : reject(new Error(`Falló: ${ruta}`));
        });
    });

const run = async () => {
    try {
        console.log("\n🚀 Iniciando importación automática…\n");

        // Importar datos con flag --auto (borra sin preguntar)
        await ejecutarScript(
            path.join(__dirname, "scripts", "importarDatos.js"),
            ["--auto"]
        );

        console.log("\n⚙️  Creando índices…\n");

        await ejecutarScript(
            path.join(__dirname, "scripts", "crearIndices.js")
        );

        console.log("\n🎉 Proceso completo: datos importados + índices creados\n");
        process.exit(0);

    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

run();
