// scripts/startDb.js
/**
 * Orchestrator script to:
 *  1. Drop the entire database.
 *  2. Insert seed data from dataset_jobs.json.
 *  3. Recreate all indexes.
 *
 * This provides a one-command "reset and seed" flow for local development.
 *
 * Usage:
 *   node scripts/startDb.js
 */

import { spawn } from "child_process";
import path from "path";

const __dirname = path.resolve();

/**
 * Execute another Node.js script as a child process.
 * StdIO is inherited so logs appear in the same terminal.
 */
const executeScript = (scriptPath, args = []) =>
    new Promise((resolve, reject) => {
        const child = spawn("node", [scriptPath, ...args], {
            stdio: "inherit",
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Script failed: ${scriptPath} (code ${code})`));
            }
        });
    });

const startDb = async () => {
    try {
        console.log("\n🚀 Starting database reset + seed + index creation...\n");

        const deleteDbScript   = path.join(__dirname, "scripts", "deleteDb.js");
        const insertDataScript = path.join(__dirname, "scripts", "insertData.js");
        const createIdxScript  = path.join(__dirname, "scripts", "createIndexes.js");

        // 1. Drop DB (no prompt, forced auto mode)
        await executeScript(deleteDbScript, ["--auto"]);

        // 2. Insert dataset (no prompt)
        await executeScript(insertDataScript, ["--auto"]);

        // 3. Create indexes
        await executeScript(createIdxScript);

        console.log("\n🎉 Database fully initialized: dropped, seeded, indexed.\n");
        process.exit(0);
    } catch (err) {
        console.error("❌ startDb error:", err.message);
        process.exit(1);
    }
};

startDb();
