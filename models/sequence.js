/**
 * =============================================================================
 *  utils/sequence.js — NEXT SEQUENCE (ATÓMICO)
 * =============================================================================
 *
 * getNextSequence("company_id") -> 1235
 * getNextSequence("job_id")     -> 10000
 */

import Counter from "../models/Counter.js";

export async function getNextSequence(name) {
    const doc = await Counter.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    ).lean();

    return doc.seq;
}
