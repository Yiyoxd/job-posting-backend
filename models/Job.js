/**
 * ============================================================================
 *  Job.js — MODELO DE EMPLEO
 * ============================================================================
 *
 * Representa una oferta de trabajo publicada por una empresa.
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

const jobSchema = new mongoose.Schema(
    {
        // Identificador interno/incremental de la vacante
        job_id: {
            type: Number,
            unique: true,
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
        pay_period: String, // HOURLY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY
        currency: String,   // USD, MXN, EUR, etc.

        // Fecha/hora en que fue publicada (si no viene, se setea sola)
        listed_time: {
            type: Date,
            default: Date.now,
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
    },
    {
        timestamps: true // createdAt + updatedAt
    }
);

/* =============================================================================
 *  INCREMENTAL AUTOMÁTICO (job_id)
 * =============================================================================
 *
 * - Si job_id YA viene definido → lo respeta (imports / seeds viejos)
 * - Si NO viene definido → obtiene el siguiente valor del counter
 */
jobSchema.pre("save", async function (next) {
    try {
        if (this.job_id !== undefined && this.job_id !== null) {
            return next();
        }

        const counter = await Counter.findOneAndUpdate(
            { _id: "job_id" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        this.job_id = counter.seq;
        return next();
    } catch (err) {
        return next(err);
    }
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
 * - listed_time NO se elimina.
 * =============================================================================
 */
jobSchema.set("toJSON", {
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

/* =============================================================================
 *  Cálculo automático de normalized_salary
 * =============================================================================
 */

const PAY_PERIOD_FACTORS = {
    HOURLY: 40 * 52,
    WEEKLY: 52,
    BIWEEKLY: 26,
    MONTHLY: 12,
    YEARLY: 1
};

function computeNormalizedSalary(min, max, period) {
    if (min == null || max == null || !period) return null;

    const avg = (min + max) / 2;
    const factor = PAY_PERIOD_FACTORS[period];

    return factor ? avg * factor : null;
}

// Al CREAR
jobSchema.pre("save", function (next) {
    this.normalized_salary = computeNormalizedSalary(
        this.min_salary,
        this.max_salary,
        this.pay_period
    );
    next();
});

// Al ACTUALIZAR
jobSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Ignorar updates que no tocan salario
    const touchesSalary =
        update.min_salary !== undefined ||
        update.max_salary !== undefined ||
        update.pay_period !== undefined;

    if (!touchesSalary) return next();

    // Documento actual en BD
    const doc = await this.model.findOne(this.getQuery()).lean();

    if (!doc) return next();

    const min = update.min_salary ?? doc.min_salary;
    const max = update.max_salary ?? doc.max_salary;
    const period = update.pay_period ?? doc.pay_period;

    update.normalized_salary = computeNormalizedSalary(min, max, period);

    next();
});


export default mongoose.model("Job", jobSchema);
