/**
 * ============================================================================
 *  Job.js — MODELO DE EMPLEO
 * ============================================================================
 *
 * Representa una oferta de trabajo publicada por una empresa.
 *
 * Un Job SIEMPRE pertenece a una Company (company_id).
 *
 * Campos principales:
 *   - title, description
 *   - salario: min, max, currency, normalized
 *   - ubicación: country, state, city
 *   - metadata: work_type, listed_time
 *
 * Índices:
 *   - job_id (búsqueda directa)
 *   - listed_time (orden cronológico)
 *   - country (filtros por región)
 *   - company_id (JOIN lógico)
 *
 * Este modelo se utiliza en:
 *   ✔ jobController.js
 *   ✔ insertData.js (importador masivo)
 *   ✔ filtros por ubicación
 * ============================================================================
 */

import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({

    // Identificador externo opcional
    job_id: {
        type: String,
        trim: true,
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

    // Tipo de trabajo (full-time, contract, remote, etc.)
    work_type: String,

    // Normalización numérica usada para análisis estadístico
    normalized_salary: Number,

    // Ubicación normalizada
    city: String,
    state: String,
    country: {
        type: String,
        index: true
    },

    // Relación con la empresa que publicó el empleo
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true
    }

}, {
    timestamps: true // createdAt + updatedAt
});

export default mongoose.model("Job", jobSchema);
