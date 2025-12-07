/**
 * insertData.js
 *
 * Inserts seed data from /data/dataset_jobs.json into MongoDB.
 *
 * Behaviors:
 *   - Loads dataset from disk.
 *   - Inserts companies, jobs and employee_count entries in batches.
 *   - Uses a ProgressBar for clean CLI feedback.
 *   - Uses Prompt for confirmation unless --auto is passed.
 *   - Uses Logger for structured output.
 *
 * Usage:
 *   node scripts/insertData.js
 *   node scripts/insertData.js --auto
 */

import fs from "fs";
import path from "path";

import Job from "../models/Job.js";
import Company from "../models/Company.js";
import EmployeeCount from "../models/EmployeeCount.js";
import { connectDB } from "../connection/db.js";

import { logger } from "../utils/logger.js";
import { createPromptFromArgs } from "../utils/prompt.js";
import { ProgressBar } from "../utils/progressBar.js";

const __dirname = path.resolve();
const prompt = createPromptFromArgs(process.argv);

// Dataset location
const DATASET_PATH = path.join(__dirname, "data", "dataset_jobs.json");

// Insert batch size
const BATCH_SIZE = 1000;

/**
 * Loads JSON dataset from disk and validates shape.
 */
function loadDataset() {
    if (!fs.existsSync(DATASET_PATH)) {
        throw new Error(`Dataset not found: ${DATASET_PATH}`);
    }

    const raw = fs.readFileSync(DATASET_PATH, "utf8");
    const docs = JSON.parse(raw);

    if (!Array.isArray(docs)) {
        throw new Error("Dataset must be a JSON array.");
    }

    return docs;
}

/**
 * Flushes a batch of companies, jobs and employeeCounts to MongoDB.
 */
async function flushBatch(batchCompanies, batchJobs, batchEmployeeCounts) {
    if (batchCompanies.length === 0) return;

    const insertedCompanies = await Company.insertMany(batchCompanies);

    const jobsToInsert = batchJobs.map((job) => ({
        ...job,
        company: insertedCompanies[job._companyIndex]._id,
    }));

    const countsToInsert = batchEmployeeCounts.map((c) => ({
        company: insertedCompanies[c._companyIndex]._id,
        employee_count: c.employee_count,
    }));

    await Job.insertMany(jobsToInsert);
    await EmployeeCount.insertMany(countsToInsert);
}

/**
 * Main insertion workflow.
 */
async function insertData() {
    try {
        await connectDB();

        const confirmed = await prompt.confirm(
            "This will INSERT dataset_jobs.json into the database. Continue? (y/n): "
        );

        if (!confirmed) {
            logger.info("Process cancelled.");
            process.exit(0);
        }

        const docs = loadDataset();
        if (docs.length === 0) {
            logger.warn("Dataset is empty. Nothing to insert.");
            process.exit(0);
        }

        logger.info("Preparing batch insertion...");
        const progress = new ProgressBar(docs.length);

        let batchCompanies = [];
        let batchJobs = [];
        let batchEmployeeCounts = [];

        let index = 0;

        for (const doc of docs) {
            const companyIndex = batchCompanies.length;

            batchCompanies.push({ ...doc.company });

            for (const emp of doc.company_employee_counts) {
                batchEmployeeCounts.push({
                    employee_count: emp.employee_count,
                    _companyIndex: companyIndex,
                });
            }

            batchJobs.push({
                ...doc.job,
                _companyIndex: companyIndex,
            });

            index++;
            progress.update(index);

            const lastBatch = index === docs.length;
            const fullBatch = index % BATCH_SIZE === 0;

            if (fullBatch || lastBatch) {
                await flushBatch(batchCompanies, batchJobs, batchEmployeeCounts);
                batchCompanies = [];
                batchJobs = [];
                batchEmployeeCounts = [];
            }
        }

        progress.finish();
        logger.success("Dataset inserted successfully.");
        process.exit(0);

    } catch (err) {
        logger.error(`insertData error: ${err.message}`);
        process.exit(1);
    }
}

insertData();
