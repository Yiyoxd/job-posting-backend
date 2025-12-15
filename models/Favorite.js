/**
 * ============================================================================
 * Favorite.js — MODELO DE FAVORITO
 * ============================================================================
 *
 * Representa la relación "un candidato guardó un empleo".
 *
 * Propósito:
 * - Guardar empleos favoritos para un candidato (sin duplicar info del Job).
 * - Permitir:
 *   - Agregar/Quitar favorito por job_id.
 *   - Listar favoritos del candidato con los jobs completos.
 *
 * Reglas:
 * - Un favorito es único por (candidate_id, job_id).
 * - favorite_id es incremental (Counter).
 *
 * Campos:
 * - favorite_id   : number incremental
 * - candidate_id  : number (id incremental del candidato)
 * - job_id        : number (id incremental del empleo)
 * - created_at    : Date (cuándo se guardó)
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

const favoriteSchema = new mongoose.Schema(
    {
        favorite_id: {
            type: Number,
            unique: true,
            index: true
        },

        candidate_id: {
            type: Number,
            required: true,
            index: true
        },

        job_id: {
            type: Number,
            required: true,
            index: true
        },

        created_at: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: false
    }
);

/* =============================================================================
 * INCREMENTAL AUTOMÁTICO (favorite_id)
 * ============================================================================= */
favoriteSchema.pre("save", async function (next) {
    if (this.favorite_id != null) return next();

    const counter = await Counter.findOneAndUpdate(
        { _id: "favorite_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.favorite_id = counter.seq;
    next();
});

/* =============================================================================
 * ÚNICO: (candidate_id, job_id)
 * =============================================================================
 * Evita duplicados de favoritos.
 */
favoriteSchema.index({ candidate_id: 1, job_id: 1 }, { unique: true });

/* =============================================================================
 * LIMPIEZA DE SALIDA
 * ============================================================================= */
const cleanTransform = (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
};

favoriteSchema.set("toJSON", { versionKey: false, virtuals: false, transform: cleanTransform });
favoriteSchema.set("toObject", { versionKey: false, virtuals: false, transform: cleanTransform });

export default mongoose.model("Favorite", favoriteSchema);
