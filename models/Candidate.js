/**
 * ============================================================================
 * Candidate.js — Modelo de Candidato
 * ============================================================================
 *
 * Representa el perfil profesional de un candidato.
 * Esta información es visible para las empresas cuando revisan postulaciones.
 *
 * - NO maneja autenticación
 * - NO contiene contraseñas
 * - Puede vincularse opcionalmente a un sistema de usuarios externo
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

/* =============================================================================
 * ESQUEMA
 * =============================================================================
 */
const candidateSchema = new mongoose.Schema(
    {
        /**
         * Identificador incremental del candidato
         */
        candidate_id: {
            type: Number,
            unique: true,
            index: true
        },

        /**
         * Nombre completo del candidato
         */
        full_name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        /**
         * Información de contacto visible para empresas
         */
        contact: {
            email: {
                type: String,
                required: true,
                lowercase: true,
                trim: true,
                index: true
            },
            phone: {
                type: String,
                trim: true
            },
            linkedin_url: {
                type: String,
                trim: true
            }
        },

        /**
         * Ubicación del candidato
         */
        country: {
            type: String,
            index: true
        },
        state: String,
        city: String,

        /**
         * Resumen profesional opcional
         */
        headline: String,

        /**
         * Fecha de creación del perfil
         */
        created_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: false
    }
);

/* =============================================================================
 * INCREMENTAL AUTOMÁTICO (candidate_id)
 * =============================================================================
 */
candidateSchema.pre("save", async function (next) {
    if (this.candidate_id != null) return next();

    const counter = await Counter.findOneAndUpdate(
        { _id: "candidate_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.candidate_id = counter.seq;
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

candidateSchema.set("toJSON", {
    versionKey: false,
    transform: cleanTransform
});

candidateSchema.set("toObject", {
    versionKey: false,
    transform: cleanTransform
});

/* =============================================================================
 * EXPORT
 * =============================================================================
 */
export default mongoose.model("Candidate", candidateSchema);
