/**
 * ============================================================================
 * FeaturedCompany.js — Modelo de Empresas Destacadas (Home)
 * ============================================================================
 *
 * Guarda la lista de empresas recomendadas para mostrarlas en la pantalla inicial.
 *
 * Diseño:
 * - company_id: referencia lógica a Company.company_id (numérico incremental)
 *
 * Reglas:
 * - company_id es único (una empresa no se repite en destacadas)
 * - El orden se toma por createdAt DESC (las más recientes primero)
 * ============================================================================
 */

import mongoose from "mongoose";

const featuredCompanySchema = new mongoose.Schema(
    {
        company_id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        }
    },
    { timestamps: true }
);

const cleanTransform = (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
};

featuredCompanySchema.set("toJSON", { versionKey: false, transform: cleanTransform });
featuredCompanySchema.set("toObject", { versionKey: false, transform: cleanTransform });

export default mongoose.model("FeaturedCompany", featuredCompanySchema);
