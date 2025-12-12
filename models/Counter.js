/**
 * =============================================================================
 *  models/Counter.js — CONTADOR INCREMENTAL (GENÉRICO)
 * =============================================================================
 *
 * Guarda secuencias incrementales por nombre:
 *   { _id: "company_id", seq: 1234 }
 *   { _id: "job_id",     seq: 9999 }
 */

import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

export default mongoose.model("Counter", counterSchema);