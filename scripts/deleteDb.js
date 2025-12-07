/**
 * deleteDb.js
 *
 * Drops the entire MongoDB database associated with the current connection.
 *
 * Features:
 *   - Safe confirmation prompt (unless --auto is passed).
 *   - Structured logging via Logger.
 *   - Clean exit codes for CI/CD or automation workflows.
 *
 * Usage:
 *   node scripts/deleteDb.js
 *   node scripts/deleteDb.js --auto   // bypass confirmation
 */

import path from "path";
import mongoose from "mongoose";
import { connectDB } from "../connection/db.js";

import { logger } from "../utils/logger.js";
import { createPromptFromArgs } from "../utils/prompt.js";

const __dirname = path.resolve();
const prompt = createPromptFromArgs(process.argv);

/**
 * Main routine used to drop the entire database.
 */
async function deleteDb() {
    try {
        await connectDB();

        const confirmed = await prompt.confirm(
            "This action will drop the entire database. Continue? (y/n): "
        );

        if (!confirmed) {
            logger.info("Operation cancelled by user.");
            process.exit(0);
        }

        logger.info("Dropping database...");
        const start = Date.now();

        await mongoose.connection.dropDatabase();

        const elapsed = Date.now() - start;
        logger.success(`Database dropped in ${elapsed} ms`);

        process.exit(0);

    } catch (error) {
        logger.error(`deleteDb error: ${error.message}`);
        process.exit(1);
    }
}

deleteDb();
