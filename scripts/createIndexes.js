/**
 * createIndexes.js
 *
 * Creates indexes for the three primary collections:
 *   - Job
 *   - Company
 *   - EmployeeCount
 *
 * This script can be executed on a populated or empty database.
 * Index creation is idempotent and safe to re-run.
 *
 * Usage:
 *   node scripts/createIndexes.js
 */

import path from "path";
import { connectDB } from "../connection/db.js";

import Job from "../models/Job.js";
import Company from "../models/Company.js";
import EmployeeCount from "../models/EmployeeCount.js";

import { logger } from "../utils/logger.js";

const __dirname = path.resolve();

/**
 * Helper function to create a single index and log its performance.
 */
async function createIndex(collection, description, fields, options, results) {
    const start = Date.now();

    try {
        await collection.createIndex(fields, options);
        const ms = Date.now() - start;
        logger.success(`${description} (${ms} ms)`);
        results.push({ description, status: "OK", time: ms });
    } catch (err) {
        logger.error(`${description} — ${err.message}`);
        results.push({ description, status: "ERROR", time: null });
    }
}

/**
 * Main index creation routine.
 */
async function createIndexes() {
    try {
        await connectDB();

        logger.info("Creating indexes...");

        const results = [];

        // ---------------------------
        // JOB COLLECTION INDEXES
        // ---------------------------
        logger.info("Job collection:");
        await createIndex(Job.collection, "job_id (unique)", { job_id: 1 }, { unique: true }, results);
        await createIndex(Job.collection, "company field", { company: 1 }, {}, results);
        await createIndex(Job.collection, "title (text)", { title: "text" }, {}, results);
        await createIndex(
            Job.collection,
            "location + salary",
            { location: 1, min_salary: 1, max_salary: 1 },
            {},
            results
        );

        // ---------------------------
        // COMPANY COLLECTION INDEXES
        // ---------------------------
        logger.info("Company collection:");
        await createIndex(Company.collection, "name (text)", { name: "text" }, {}, results);
        await createIndex(Company.collection, "country + city", { country: 1, city: 1 }, {}, results);

        // ---------------------------
        // EMPLOYEECOUNT COLLECTION INDEXES
        // ---------------------------
        logger.info("EmployeeCount collection:");
        await createIndex(EmployeeCount.collection, "company", { company: 1 }, {}, results);
        await createIndex(EmployeeCount.collection, "employee_count desc", { employee_count: -1 }, {}, results);

        logger.success("Indexes created successfully.");
        process.exit(0);

    } catch (error) {
        logger.error(`createIndexes error: ${error.message}`);
        process.exit(1);
    }
}

createIndexes();
