/**
 * ============================================================================
 * Application.js — Modelo de Postulación
 * ============================================================================
 *
 * Representa una postulación de un candidato a un empleo.
 *
 * Relaciones:
 *   - Candidate → candidate_id
 *   - Job       → job_id
 *   - Company   → company_id (derivado del Job)
 *
 * Reglas:
 *   - Un candidato solo puede postular una vez por empleo
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

/* =============================================================================
 * ESQUEMA
 * =============================================================================
 */
const applicationSchema = new mongoose.Schema(
    {
        /**
         * Identificador incremental de la postulación
         */
        application_id: {
            type: Number,
            unique: true,
            index: true
        },

        /**
         * Identificador del empleo
         */
        job_id: {
            type: Number,
            required: true,
            index: true
        },

        /**
         * Identificador del candidato
         */
        candidate_id: {
            type: Number,
            required: true,
            index: true
        },

        /**
         * Identificador de la empresa (derivado del Job)
         */
        company_id: {
            type: Number,
            required: true,
            index: true
        },

        /**
         * Estado del proceso de selección
         */
        status: {
            type: String,
            enum: [
                "APPLIED",
                "REVIEWING",
                "INTERVIEW",
                "OFFERED",
                "REJECTED",
                "HIRED"
            ],
            default: "APPLIED",
            index: true
        },

        /**
         * Fecha de postulación
         */
        applied_at: {
            type: Date,
            default: Date.now,
            index: true
        },

        /**
         * Última actualización
         */
        updated_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: false
    }
);

/* =============================================================================
 * ÍNDICES COMPUESTOS
 * =============================================================================
 */

// Evita doble postulación al mismo empleo
applicationSchema.index(
    { candidate_id: 1, job_id: 1 },
    { unique: true }
);

/* =============================================================================
 * INCREMENTAL AUTOMÁTICO (application_id)
 * =============================================================================
 */
applicationSchema.pre("save", async function (next) {
    if (this.application_id != null) return next();

    const counter = await Counter.findOneAndUpdate(
        { _id: "application_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.application_id = counter.seq;
    this.updated_at = new Date();
    next();
});

/* =============================================================================
 * SINCRONIZACIÓN updated_at
 * =============================================================================
 */
applicationSchema.pre("findOneAndUpdate", function (next) {
    this.set({ updated_at: new Date() });
    next();
});

/* =============================================================================
 * LIMPIEZA DE SALIDA
 * =============================================================================
 */
const cleanTransform = (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
};

applicationSchema.set("toJSON", {
    versionKey: false,
    transform: cleanTransform
});

applicationSchema.set("toObject", {
    versionKey: false,
    transform: cleanTransform
});

/* =============================================================================
 * EXPORT
 * =============================================================================
 */
export default mongoose.model("Application", applicationSchema);
