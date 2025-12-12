/**
 * ============================================================================
 *  Company.js — MODELO DE EMPRESA
 * ============================================================================
 *
 * - Genera automáticamente company_id incremental si NO viene definido.
 * - Respeta company_id existente (imports / seeds viejos).
 * - Limpia campos internos antes de enviar al frontend.
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

/* =============================================================================
 *  ESQUEMA
 * =============================================================================
 */
const companySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        // Identificador incremental interno de la empresa
        company_id: {
            type: Number,
            unique: true,
            index: true
        },

        description: String,

        // Ubicación
        country: {
            type: String,
            index: true
        },
        state: String,
        city: String,

        address: String,

        // Tamaño aproximado de la empresa
        company_size_min: Number,
        company_size_max: Number
    },
    {
        timestamps: true
    }
);

/* =============================================================================
 *  INCREMENTAL AUTOMÁTICO (company_id)
 * =============================================================================
 *
 * - Si company_id YA viene definido → no hace nada
 * - Si NO viene definido → obtiene el siguiente valor del counter
 */
companySchema.pre("save", async function (next) {
    if (this.company_id !== undefined && this.company_id !== null) {
        return next();
    }

    const counter = await Counter.findOneAndUpdate(
        { _id: "company_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.company_id = counter.seq;
    next();
});

/* =============================================================================
 *  LIMPIEZA DE SALIDA (JSON / OBJECT)
 * =============================================================================
 */
const cleanTransform = (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
};

companySchema.set("toJSON", {
    versionKey: false,
    virtuals: false,
    transform: cleanTransform
});

companySchema.set("toObject", {
    versionKey: false,
    virtuals: false,
    transform: cleanTransform
});

/* =============================================================================
 *  EXPORT
 * =============================================================================
 */
export default mongoose.model("Company", companySchema);
