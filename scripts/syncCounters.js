/**
 * =============================================================================
 *  scripts/syncCounters.js — SINCRONIZA COUNTERS AL MAX REAL
 * =============================================================================
 *
 * Úsalo DESPUÉS de tu import:
 *   node scripts/syncCounters.js
 *
 * Esto evita colisiones cuando crees nuevos docs desde tu API.
 */

import { connectDB } from "../connection/db.js";
import { logger } from "../utils/logger.js";

import Company from "../models/Company.js";
import Job from "../models/Job.js";
import Counter from "../models/Counter.js";

async function getMax(Model, field) {
    const doc = await Model.findOne({ [field]: { $ne: null } })
        .sort({ [field]: -1 })
        .select({ [field]: 1 })
        .lean();

    return doc?.[field] ?? 0;
}

async function sync() {
    await connectDB();

    logger.section("Sincronizando counters");

    const maxCompanyId = await getMax(Company, "company_id");
    const maxJobId = await getMax(Job, "job_id");

    await Counter.updateOne(
        { _id: "company_id" },
        { $set: { seq: maxCompanyId } },
        { upsert: true }
    );

    await Counter.updateOne(
        { _id: "job_id" },
        { $set: { seq: maxJobId } },
        { upsert: true }
    );

    logger.success(`✔ company_id seq = ${maxCompanyId}`);
    logger.success(`✔ job_id     seq = ${maxJobId}`);

    process.exit(0);
}

sync().catch((err) => {
    logger.error(`❌ Error syncCounters: ${err.message}`);
    process.exit(1);
});
