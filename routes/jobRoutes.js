/**
 * ============================================================================
 *  jobRoutes.js — RUTAS DE EMPLEOS
 * ============================================================================
 *
 * Define todos los endpoints relacionados con la entidad Job.
 *
 * Prefijo recomendado en server.js:
 *   app.use("/api/jobs", jobRoutes);
 *
 * --------------------------------------------------------------------------
 *  RESUMEN DE ENDPOINTS
 * --------------------------------------------------------------------------
 *
 * 1) GET /api/jobs
 *    → Listar empleos con filtros, paginación y ranking avanzado.
 *
 *    Query params soportados:
 *
 *      Búsqueda por texto:
 *        - q                  → texto libre. Se busca en title + description.
 *
 *      Filtros de ubicación:
 *        - country            → país (ej: "Mexico", "United States")
 *        - state              → estado / región (ej: "Coahuila", "California")
 *        - city               → ciudad (ej: "Torreon", "San Francisco")
 *
 *      Filtros de tipo de trabajo:
 *        - work_type          → "FULL_TIME", "PART_TIME", "CONTRACT",
 *                               "INTERNSHIP", "TEMPORARY", "VOLUNTEER", "OTHER"
 *
 *      Filtros de modalidad:
 *        - work_location_type → "ONSITE" | "HYBRID" | "REMOTE"
 *          (no importa mayúsculas/minúsculas; el backend lo convierte a UPPERCASE)
 *
 *      Filtros de pago:
 *        - pay_period         → "HOURLY", "MONTHLY", "YEARLY", etc.
 *        - min_salary         → filtra jobs con min_salary >= valor
 *        - max_salary         → filtra jobs con max_salary <= valor
 *        - min_norm_salary    → filtra normalized_salary >= valor
 *        - max_norm_salary    → filtra normalized_salary <= valor
 *
 *      Filtros de empresa:
 *        - company_id         → ObjectId de Company (solo en /api/jobs)
 *
 *      Filtros de fechas:
 *        - listed_from        → fecha mínima (YYYY-MM-DD)
 *        - listed_to          → fecha máxima (YYYY-MM-DD)
 *
 *      Paginación:
 *        - page               → número de página (1-based). Default: 1
 *        - limit              → elementos por página. Default: 20
 *
 *      Ordenamiento:
 *        - sortBy             → "listed_time" | "min_salary" |
 *                               "max_salary" | "normalized_salary" | "createdAt"
 *        - sortDir            → "asc" | "desc". Default: "desc"
 *
 *    Comportamiento especial:
 *      - Si se envía q y NO se envía sortBy:
 *          → se usa el ranking avanzado con $text + score compuesto.
 *      - Si no hay q, o si hay q pero sí se manda sortBy:
 *          → se usa ordenamiento simple por sortBy/sortDir.
 *
 *    Respuesta:
 *      {
 *        meta: {
 *          page,
 *          limit,
 *          total,
 *          totalPages
 *        },
 *        data: [ { ...job, company_id: { ...company } }, ... ]
 *      }
 *
 * --------------------------------------------------------------------------
 *
 * 2) GET /api/jobs/:id
 *    → Obtiene un único empleo por su ObjectId de MongoDB.
 *
 *    Path params:
 *      - :id → ObjectId del job (campo _id de Mongo)
 *
 *    Respuesta:
 *      - 200 → documento del job con company_id populado (name, country, state, city, url)
 *      - 404 → { error: "Empleo no encontrado" }
 *
 * --------------------------------------------------------------------------
 *
 * 3) GET /api/jobs/company/:companyId
 *    → Lista empleos publicados por una empresa específica (company_id),
 *      con soporte de TODOS los filtros, paginación y ranking avanzado.
 *
 *    Path params:
 *      - :companyId → ObjectId de la empresa (Company._id)
 *
 *    Query params:
 *      - Mismos que GET /api/jobs, EXCEPTO company_id,
 *        porque aquí el ID "oficial" viene en la ruta.
 *
 *    Respuesta:
 *      Igual que GET /api/jobs:
 *      {
 *        meta: {...},
 *        data: [ ...jobs ]
 *      }
 *
 * --------------------------------------------------------------------------
 *
 * 4) GET /api/jobs/filters/options
 *    → Devuelve los valores distintos (distinct) para construir combos
 *      de filtros en el frontend.
 *
 *    Respuesta:
 *      {
 *        countries:           [...],
 *        states:              [...],
 *        cities:              [...],
 *        work_types:          [...],
 *        work_location_types: [...],
 *        pay_periods:         [...]
 *      }
 *
 *    Uso típico en el frontend:
 *      - Poblar selects de país/estado/ciudad.
 *      - Llenar opciones de tipo de trabajo.
 *      - Llenar opciones de modalidad (ONSITE / HYBRID / REMOTE).
 *
 * --------------------------------------------------------------------------
 *
 * 5) POST /api/jobs
 *    → Crea un nuevo empleo.
 *
 *    Body esperado (JSON):
 *      {
 *        job_id?: string,
 *        title: string,
 *        description?: string,
 *        max_salary?: number,
 *        min_salary?: number,
 *        pay_period?: string,
 *        currency?: string,
 *        job_posting_url?: string,
 *        listed_time?: string (ISO),
 *        work_type?: string,
 *        work_location_type?: "ONSITE" | "HYBRID" | "REMOTE",
 *        normalized_salary?: number,
 *        city?: string,
 *        state?: string,
 *        country?: string,
 *        company_id: string (ObjectId de Company)
 *      }
 *
 *    Respuesta:
 *      - 201 → job creado
 *      - 500 → error en servidor
 *
 * --------------------------------------------------------------------------
 *
 * 6) PUT /api/jobs/:id
 *    → Actualiza un empleo existente.
 *
 *    Path params:
 *      - :id → ObjectId del job
 *
 *    Body:
 *      - Cualquier subset de los campos del modelo Job.
 *
 *    Respuesta:
 *      - 200 → job actualizado
 *      - 404 → empleo no encontrado
 *
 * --------------------------------------------------------------------------
 *
 * 7) DELETE /api/jobs/:id
 *    → Elimina un empleo.
 *
 *    Path params:
 *      - :id → ObjectId del job
 *
 *    Respuesta:
 *      - 200 → { message: "Empleo eliminado correctamente" }
 *      - 404 → empleo no encontrado
 *
 * ============================================================================
 */

import { Router } from "express";
import {
    getJobs,
    getJobById,
    getJobsByCompany,
    getJobFilterOptions,
    createJob,
    updateJob,
    deleteJob
} from "../controllers/jobController.js";

const router = Router();

/* =============================================================================
 *  GET /api/jobs — Listado con filtros + ranking avanzado
 * =============================================================================
 *
 *  Ejemplos de uso desde el frontend:
 *
 *    1) Todos los empleos (paginación default):
 *       GET /api/jobs
 *
 *    2) Buscar "senior backend engineer":
 *       GET /api/jobs?q=senior%20backend%20engineer
 *
 *    3) Buscar "software engineer" remoto en Estados Unidos:
 *       GET /api/jobs?q=software%20engineer&country=United%20States&work_location_type=REMOTE
 *
 *    4) Filtrar por rango salarial normalizado:
 *       GET /api/jobs?min_norm_salary=80000&max_norm_salary=200000
 *
 *    5) Filtrar por país/estado/ciudad:
 *       GET /api/jobs?country=Mexico&state=Coahuila&city=Torreon
 *
 *    6) Ordenar por salario máximo ascendente:
 *       GET /api/jobs?sortBy=max_salary&sortDir=asc
 *
 *    7) Paginar:
 *       GET /api/jobs?page=2&limit=50
 */
router.get("/", getJobs);

/* =============================================================================
 *  GET /api/jobs/filters/options — Opciones de filtros (distincts)
 * =============================================================================
 *
 *  Ejemplo:
 *    GET /api/jobs/filters/options
 *
 *  Respuesta:
 *    {
 *      countries:           [...],
 *      states:              [...],
 *      cities:              [...],
 *      work_types:          [...],
 *      work_location_types: [...],
 *      pay_periods:         [...]
 *    }
 */
router.get("/filters/options", getJobFilterOptions);

/* =============================================================================
 *  GET /api/jobs/company/:companyId — Empleos por empresa
 * =============================================================================
 *
 *  Ejemplo:
 *    GET /api/jobs/company/675f1a3c2c5a9b1234567890?q=backend%20engineer&work_location_type=REMOTE
 *
 *  Notas:
 *    - Soporta mismos filtros que /api/jobs, excepto company_id (se toma del path).
 *    - Usa el mismo ranking avanzado cuando se envía q sin sortBy.
 */
router.get("/company/:companyId", getJobsByCompany);

/* =============================================================================
 *  GET /api/jobs/:id — Obtener empleo por ID
 * =============================================================================
 *
 *  Ejemplo:
 *    GET /api/jobs/6936154f752aebc865840e2e
 */
router.get("/:id", getJobById);

/* =============================================================================
 *  POST /api/jobs — Crear empleo
 * =============================================================================
 *
 *  Ejemplo:
 *    POST /api/jobs
 *    Body (JSON):
 *    {
 *      "title": "Senior Backend Engineer",
 *      "description": "Trabajo remoto con stack Node.js...",
 *      "min_salary": 120000,
 *      "max_salary": 180000,
 *      "pay_period": "YEARLY",
 *      "currency": "USD",
 *      "work_type": "FULL_TIME",
 *      "work_location_type": "REMOTE",
 *      "country": "United States",
 *      "state": "California",
 *      "city": "San Francisco",
 *      "company_id": "675f1a3c2c5a9b1234567890"
 *    }
 */
router.post("/", createJob);

/* =============================================================================
 *  PUT /api/jobs/:id — Actualizar empleo
 * =============================================================================
 *
 *  Ejemplo:
 *    PUT /api/jobs/6936154f752aebc865840e2e
 *    Body (JSON):
 *    {
 *      "work_location_type": "HYBRID",
 *      "city": "New York"
 *    }
 */
router.put("/:id", updateJob);

/* =============================================================================
 *  DELETE /api/jobs/:id — Eliminar empleo
 * =============================================================================
 *
 *  Ejemplo:
 *    DELETE /api/jobs/6936154f752aebc865840e2e
 */
router.delete("/:id", deleteJob);

export default router;
