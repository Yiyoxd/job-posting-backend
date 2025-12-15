/**
 * setupEverything.js
 *
 * Full initialization pipeline for the system.
 *
 * Steps:
 *   1. Start DB (drop, insert data, create indexes)
 *   2. Standardize company logos
 *   3. Optionally run `npm run dev`
 *
 * Dependencies:
 *   - logger (for structured output)
 *   - prompt (for confirmations)
 *
 * NOTE: ScriptExecutor class is embedded here to avoid creating new files.
 */

import path from "path";
import { spawn } from "child_process";

import { logger } from "../utils/logger.js";
import { createPromptFromArgs } from "../utils/prompt.js";

const __dirname = path.resolve();
const prompt = createPromptFromArgs(process.argv);

/* ---------------------------------------------------------------------------
 * ScriptExecutor (embedded version)
 * ---------------------------------------------------------------------------
 * Runs Node scripts and npm commands in a uniform, structured way.
 * No external module needed — kept local per your request.
 */
class ScriptExecutor {
    constructor(baseDir) {
        this.baseDir = baseDir;
    }

    resolve(file) {
        return path.join(this.baseDir, file);
    }

    /**
     * Executes a Node.js script and streams logs to the terminal.
     */
    run(label, scriptPath, args = []) {
        const fullPath = this.resolve(scriptPath);
        logger.info(`Starting: ${label}`);

        return new Promise((resolve, reject) => {
            const proc = spawn("node", [fullPath, ...args], {
                stdio: "inherit",
            });

            proc.on("close", (code) => {
                if (code === 0) {
                    logger.success(`Completed: ${label}`);
                    resolve();
                } else {
                    logger.error(`Failed: ${label} (exit code ${code})`);
                    reject(new Error(label));
                }
            });
        });
    }

    /**
     * Executes an npm script such as `npm run dev`.
     */
    runNpm(command) {
        logger.info(`Running npm script: ${command}`);

        return new Promise((resolve, reject) => {
            const proc = spawn("npm", ["run", command], {
                stdio: "inherit",
                shell: true,
            });

            proc.on("close", (code) => {
                if (code === 0) {
                    logger.success(`npm run ${command} completed.`);
                    resolve();
                } else {
                    logger.error(`npm run ${command} failed.`);
                    reject(new Error(`npm run ${command}`));
                }
            });
        });
    }
}

/* ---------------------------------------------------------------------------
 * Main setup pipeline
 * ---------------------------------------------------------------------------
 */

const executor = new ScriptExecutor(__dirname);

async function setup() {
    try {
        logger.section("Full System Setup");

        // 1. Start DB (drop + insert + indexes)
        await executor.run("Initialize Database", "scripts/startDb.js");

        // 2. Process all logos
        await executor.run("Standardize Company Logos", "scripts/standardize_logos.js");

        logger.success("System setup completed.");

        // 3 Crear los usuarios de prueba
        await executor.run("Crear usuarios de prueba", "scripts/createUsers.js");

        // 3. Ask user if they want to run the dev server
        const runDev = await prompt.confirm("Iniciar server? (y/n): ");

        if (runDev) {
            await executor.runNpm("dev");
        } else {
            logger.info("Development server not started.");
        }

        process.exit(0);

    } catch (err) {
        logger.error(`Setup aborted: ${err.message}`);
        process.exit(1);
    }
}

setup();
