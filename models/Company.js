/**
 * ============================================================================
 *  jobController.js — CONTROLADOR DE EMPLEOS
 * ============================================================================
 *
 * Endpoints implementados:
 *
 *   GET /api/jobs
 *       → Lista de empleos con filtros opcionales
 *
 *   GET /api/jobs/:id
 *       → Obtener empleo por ID
 *
 *   GET /api/jobs/company/:company_id
 *       → Empleos publicados por una empresa
 *
 *   POST /api/jobs
 *       → Crear empleo nuevo
 *
 *   PUT /api/jobs/:id
 *       → Actualizar empleo existente
 *
 *   DELETE /api/jobs/:id
 *       → Eliminar empleo
 *
 * Filtros disponibles en GET /api/jobs:
 *   - country
 *   - state
 *   - city
 *   - min_salary
 *   - max_salary
 *   - work_type
 *   - q (texto en título/descr)
 * ============================================================================
 */

import Job from "../models/Job.js";
import Company from "../models/Company.js";

// -----------------------------------------------------------------------------
// GET /api/jobs — listado con filtros avanzados
// -----------------------------------------------------------------------------
export async function getJobs(req, res) {
    try {
        const query = {};

        // Filtros de ubicación
        if (req.query.country) query.country = req.query.country;
        if (req.query.state) query.state = req.query.state;
        if (req.query.city) query.city = req.query.city;

        // Filtros por salario
        if (req.query.min_salary)
            query.min_salary = { $gte: Number(req.query.min_salary) };

        if (req.query.max_salary)
            query.max_salary = { $lte: Number(req.query.max_salary) };

        // Filtro por tipo de trabajo
        if (req.query.work_type)
            query.work_type = req.query.work_type;

        // Buscar en título / descripción
        if (req.query.q) {
            const regex = new RegExp(req.query.q, "i");
            query.$or = [
                { title: regex },
                { description: regex }
            ];
        }

        const jobs = await Job.find(query).populate("company_id");

        res.json(jobs);

    } catch (err) {
        res.status(500).json({ error: "Error al obtener empleos", details: err.message });
    }
}

// -----------------------------------------------------------------------------
// GET /api/jobs/:id — obtener un empleo por su ID
// -----------------------------------------------------------------------------
export async function getJobById(req, res) {
    try {
        const job = await Job.findById(req.params.id).populate("company_id");

        if (!job) return res.status(404).json({ error: "Empleo no encontrado" });

        res.json(job);

    } catch (err) {
        res.status(500).json({ error: "Error al obtener empleo", details: err.message });
    }
}

// -----------------------------------------------------------------------------
// GET /api/jobs/company/:company_id — obtener empleos por empresa
// -----------------------------------------------------------------------------
export async function getJobsByCompany(req, res) {
    try {
        const jobs = await Job.find({ company_id: req.params.company_id });

        res.json(jobs);

    } catch (err) {
        res.status(500).json({ error: "Error", details: err.message });
    }
}

// -----------------------------------------------------------------------------
// POST /api/jobs — crear un empleo
// -----------------------------------------------------------------------------
export async function createJob(req, res) {
    try {
        const job = await Job.create(req.body);
        res.status(201).json(job);

    } catch (err) {
        res.status(500).json({ error: "Error al crear empleo", details: err.message });
    }
}

// -----------------------------------------------------------------------------
// PUT /api/jobs/:id — actualizar un empleo
// -----------------------------------------------------------------------------
export async function updateJob(req, res) {
    try {
        const updated = await Job.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated)
            return res.status(404).json({ error: "Empleo no encontrado" });

        res.json(updated);

    } catch (err) {
        res.status(500).json({ error: "Error al actualizar empleo", details: err.message });
    }
}

// -----------------------------------------------------------------------------
// DELETE /api/jobs/:id — eliminar un empleo
// -----------------------------------------------------------------------------
export async function deleteJob(req, res) {
    try {
        const deleted = await Job.findByIdAndDelete(req.params.id);

        if (!deleted)
            return res.status(404).json({ error: "Empleo no encontrado" });

        res.json({ message: "Empleo eliminado correctamente" });

    } catch (err) {
        res.status(500).json({ error: "Error al eliminar empleo", details: err.message });
    }
}
