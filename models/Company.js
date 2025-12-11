/**
 * ============================================================================
 *  Company.js — MODELO DE EMPRESA
 * ============================================================================
 *
 * Representa una empresa que publica ofertas de trabajo.
 *
 * Campos principales:
 *   - name, description
 *   - tamaño (company_size_min, company_size_max)
 *   - ubicación: country, state, city, address
 *   - url oficial de la empresa
 *
 * Índices:
 *   - name (para buscador global)
 *   - country (filtros geográficos)
 *
 * Este modelo se usa en:
 *   ✔ jobController.js (JOIN por company_id)
 *   ✔ importadores (primer se insertan empresas)
 * ============================================================================
 */

import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // buscador rápido
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

export default mongoose.model("Company", companySchema);
