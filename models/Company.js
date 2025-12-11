/**
 * ============================================================================
 *  Company.js — MODELO DE EMPRESA
 * ============================================================================
 */

import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    description: String,

    // Ubicación global
    country: {
        type: String,
        index: true
    },
    state: String,
    city: String,

    address: String,

    // Sitio web de la empresa
    url: String,

    // Tamaño aproximado de la empresa (rango)
    company_size_min: Number,
    company_size_max: Number

}, {
    timestamps: true
});

/* =============================================================================
 *  Limpieza automática del JSON enviado al frontend
 * =============================================================================
 *
 * - NO exponemos el _id ni un campo id.
 * - Eliminamos:
 *     _id
 *     __v
 *     createdAt
 *     updatedAt
 * =============================================================================
 */
companySchema.set("toJSON", {
    versionKey: false,
    virtuals: false,
    transform: (doc, ret) => {
        // No exponemos el id interno
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
    }
});

companySchema.set("toObject", {
    versionKey: false,
    virtuals: false,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
    }
});

export default mongoose.model("Company", companySchema);
