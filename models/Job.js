/**
 * ============================================================================
 *  Job.js — MODELO DE EMPLEO
 * ============================================================================
 *
 * Representa una oferta de trabajo publicada por una empresa.
 * ============================================================================
 */

import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({

    // Identificador interno/incremental de la vacante
    job_id: {
        type: Number,
        index: true
    },

    // Título de la vacante
    title: {
        type: String,
        trim: true
    },

    // Descripción larga del puesto
    description: String,

    // Manejo de salarios
    max_salary: Number,
    min_salary: Number,
    pay_period: String,   // hourly, monthly, yearly
    currency: String,     // USD, MXN, EUR, etc.

    // URL original donde se publicó el empleo
    job_posting_url: String,

    // Fecha en que fue publicada
    listed_time: {
        type: Date,
        index: true
    },

    // Tipo de trabajo (FULL_TIME, PART_TIME, CONTRACT...)
    work_type: String,

    // Modalidad del trabajo (REMOTE / ONSITE / HYBRID)
    work_location_type: {
        type: String,
        enum: ["ONSITE", "HYBRID", "REMOTE"],
        index: true
    },

    // Normalización numérica usada para análisis estadístico
    normalized_salary: Number,

    // Ubicación normalizada
    city: String,
    state: String,
    country: {
        type: String,
        index: true
    },

    // Relación con la empresa que publicó el empleo (por company_id numérico)
    company_id: {
        type: Number,
        required: true,
        index: true
    }

}, {
    timestamps: true // createdAt + updatedAt
});

/* =============================================================================
 *  Limpieza automática del JSON enviado al frontend
 * =============================================================================
 *
 * - NO exponemos _id ni id (interno de Mongo).
 * - Eliminamos:
 *     _id
 *     __v
 *     createdAt
 *     updatedAt
 * - Si company_id viene populado, también se limpia igual.
 *   (En el esquema actual company_id es Number, así que normalmente no aplica)
 * =============================================================================
 */
jobSchema.set("toJSON", {
    versionKey: false,
    virtuals: false,
    transform: (doc, ret) => {
        // No exponemos el id interno del Job
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;

        // Si viene company_id populado como objeto por algún motivo, también lo limpiamos
        if (ret.company_id && typeof ret.company_id === "object") {
            delete ret.company_id._id;
            delete ret.company_id.__v;
            delete ret.company_id.createdAt;
            delete ret.company_id.updatedAt;
            delete ret.company_id.id; // por si lo hubiera puesto otro transform
        }

        return ret;
    }
});

jobSchema.set("toObject", {
    versionKey: false,
    virtuals: false,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;

        if (ret.company_id && typeof ret.company_id === "object") {
            delete ret.company_id._id;
            delete ret.company_id.__v;
            delete ret.company_id.createdAt;
            delete ret.company_id.updatedAt;
            delete ret.company_id.id;
        }

        return ret;
    }
});

export default mongoose.model("Job", jobSchema);
