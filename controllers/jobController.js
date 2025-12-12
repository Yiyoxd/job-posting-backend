/**
 * ============================================================================
 *  jobController.js — CONTROLADOR HTTP DE EMPLEOS (EXPRESS)
 * ============================================================================
 *
 * ESTE ARCHIVO:
 *   - No contiene lógica de negocio compleja.
 *   - Solo:
 *       * Lee req.query / req.params / req.body
 *       * Llama a funciones del jobService
 *       * Maneja errores y status codes
 *       * Define el CONTRATO HTTP para el frontend
 *
 * Endpoints (ver jobRoutes.js):
 *
 *   GET  /api/jobs
 *        → Listar empleos con filtros, paginación y ordenamiento.
 *
 *   GET  /api/jobs/:id
 *        → Obtener un empleo por su ID.
 *
 *   GET  /api/jobs/company/:companyId
 *        → Listar empleos publicados por una empresa específica, con filtros.
 *
 *   GET  /api/jobs/filters/options
 *        → Obtener opciones/distincts para construir filtros en el frontend.
 *
 *   POST /api/jobs
 *        → Crear un nuevo empleo.
 *
 *   PUT  /api/jobs/:id
 *        → Actualizar un empleo existente.
 *
 *   DELETE /api/jobs/:id
 *        → Eliminar un empleo.
 *
 * TODOS los contratos de respuesta están detallados en los JSDoc de cada
 * función para que el frontend sepa exactamente qué esperar.
 * ============================================================================
 */

import {
    getJobsService,
    getJobByIdService,
    getJobsByCompanyService,
    getJobFilterOptionsService,
    createJobService,
    updateJobService,
    deleteJobService
} from "../services/jobService.js";


/* =============================================================================
 *  GET /api/jobs — Listado de empleos con filtros, paginación y ranking
 * =============================================================================
 */

/**
 * GET /api/jobs
 * -------------
 * Lista empleos con filtros, paginación, ordenamiento y ranking avanzado.
 *
 * QUERY PARAMS (todos opcionales, se pueden combinar):
 *
 *   - q                  : string
 *       Búsqueda por texto (title, description).
 *
 *   - country            : string
 *   - state              : string
 *   - city               : string
 *       Filtros de ubicación.
 *
 *   - work_type          : string
 *       Tipo de trabajo (FULL_TIME, PART_TIME, CONTRACT, etc.).
 *
 *   - work_location_type : string
 *       Modalidad: ONSITE | HYBRID | REMOTE
 *
 *   - pay_period         : string
 *       Período de pago: HOURLY, DAILY, MONTHLY, YEARLY, etc.
 *
 *   - company_id         : string | number
 *       ID de empresa. Solo aplicable aquí (en /api/jobs).
 *
 *   - min_salary         : number
 *   - max_salary         : number
 *       Filtros sobre min_salary y max_salary del job.
 *
 *   - min_norm_salary    : number
 *   - max_norm_salary    : number
 *       Filtros sobre normalized_salary (campo normalizado).
 *
 *   - listed_from        : string (YYYY-MM-DD)
 *   - listed_to          : string (YYYY-MM-DD)
 *       Rango de fechas de publicación (listed_time).
 *
 * Paginación:
 *   - page               : number (1-based, default = 1)
 *   - limit              : number (default = 20)
 *
 * Ordenamiento:
 *   - sortBy             : listed_time | min_salary | max_salary | normalized_salary | createdAt
 *   - sortDir            : asc | desc (default = desc)
 *
 * REGLAS DE RANKING:
 *   - Si hay q y NO se especifica sortBy:
 *       → Usa ranking avanzado (aggregate + finalScore).
 *
 *   - Si hay q y SÍ se especifica sortBy:
 *       → Búsqueda regex en título/descripción y ordena por sortBy/sortDir.
 *
 *   - Si NO hay q:
 *       → Ordena por sortBy/sortDir o listed_time desc por defecto.
 *
 * RESPUESTA (200 OK):
 *   {
 *     "meta": {
 *       "page": number,
 *       "limit": number,
 *       "total": number,
 *       "totalPages": number
 *     },
 *     "data": [
 *       {
 *         // Campos del Job (id, title, description, etc.)
 *         "company": {
 *           "name": string | null,
 *           "company_id": number | null,
 *           "description": string | null,
 *           "country": string | null,
 *           "state": string | null,
 *           "city": string | null,
 *           "address": string | null,
 *           "url": string | null,
 *           "company_size_min": number | null,
 *           "company_size_max": number | null,
 *           "logo": string | null  // URL absoluta del logo
 *         }
 *       },
 *       ...
 *     ]
 *   }
 */
export async function getJobs(req, res) {
    try {
        const result = await getJobsService(req.query);

        res.json({
            meta: result.meta,
            data: result.data
        });
    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empleos",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/jobs/:id — Obtener un empleo por su ID
 * =============================================================================
 */

/**
 * GET /api/jobs/:id
 * -----------------
 * Obtiene un empleo individual por su ID de Mongo.
 *
 * PATH PARAMS:
 *   - id: string (ObjectId de Mongo del Job).
 *
 * RESPUESTAS:
 *
 *   200 OK:
 *     {
 *       // Campos del Job
 *       "company": {
 *         ... // Igual que en /api/jobs
 *       }
 *     }
 *
 *   404 Not Found:
 *     { "error": "Empleo no encontrado" }
 */
export async function getJobById(req, res) {
    try {
        const job = await getJobByIdService(req.params.id);

        if (!job) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(job);
    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/jobs/company/:companyId — Empleos por empresa (con filtros + ranking)
 * =============================================================================
 */

/**
 * GET /api/jobs/company/:companyId
 * --------------------------------
 * Lista empleos pertenecientes a UNA empresa específica,
 * aplicando los mismos filtros y reglas de ranking que /api/jobs,
 * pero con el company_id forzado a :companyId.
 *
 * PATH PARAMS:
 *   - companyId: string | number (ID de la empresa, el mismo que viene en los jobs).
 *
 * QUERY PARAMS:
 *   - Todos los mismos que /api/jobs, excepto company_id (aquí se ignora).
 *
 * RESPUESTA:
 *   Igual formato que /api/jobs:
 *   {
 *     "meta": { ... },
 *     "data": [ ...jobs con company... ]
 *   }
 */
export async function getJobsByCompany(req, res) {
    try {
        const companyId = req.params.companyId;

        const result = await getJobsByCompanyService(companyId, req.query);

        res.json({
            meta: result.meta,
            data: result.data
        });
    } catch (err) {
        res.status(500).json({
            error: "Error al obtener empleos de la empresa",
            details: err.message
        });
    }
}

/* =============================================================================
 *  GET /api/jobs/filters/options — Opciones de filtros (distincts)
 * =============================================================================
 */

/**
 * GET /api/jobs/filters/options
 * -----------------------------
 * Devuelve los valores únicos (distinct) para construir filtros en el frontend.
 *
 * NO recibe parámetros.
 *
 * RESPUESTA (200 OK):
 *   {
 *     "countries":           string[],
 *     "states":              string[],
 *     "cities":              string[],
 *     "work_types":          string[],
 *     "work_location_types": string[],
 *     "pay_periods":         string[]
 *   }
 *
 * Todos los arreglos vienen:
 *   - sin valores vacíos
 *   - ordenados alfabéticamente
 */
export async function getJobFilterOptions(req, res) {
    try {
        const options = await getJobFilterOptionsService();
        res.json(options);
    } catch (err) {
        res.status(500).json({
            error: "Error al obtener opciones de filtros",
            details: err.message
        });
    }
}

/* =============================================================================
 *  POST /api/jobs — Crear un nuevo empleo
 * =============================================================================
 */

/**
 * POST /api/jobs
 * --------------
 * Crea un nuevo empleo.
 *
 * BODY (JSON) — ejemplo simplificado:
 *   {
 *     "title": "Software Engineer",
 *     "description": "Job description...",
 *     "country": "United States",
 *     "state": "California",
 *     "city": "San Francisco",
 *     "company_id": 123,
 *     "work_type": "FULL_TIME",
 *     "work_location_type": "HYBRID",
 *     "pay_period": "YEARLY",
 *     "min_salary": 100000,
 *     "max_salary": 150000,
 *     "normalized_salary": 120000,
 *     "listed_time": "2024-10-01T00:00:00.000Z",
 *     ...
 *   }
 *
 * RESPUESTA:
 *   201 Created:
 *     {
 *       // Job creado con todos sus campos,
 *       // más el objeto "company" ya resuelto.
 *     }
 *
 *   500 Error:
 *     {
 *       "error": "Error al crear empleo",
 *       "details": "<mensaje interno>"
 *     }
 */
export async function createJob(req, res) {
    try {
        const formatted = await createJobService(req.body);
        res.status(201).json(formatted);
    } catch (err) {
        res.status(500).json({
            error: "Error al crear empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  PUT /api/jobs/:id — Actualizar un empleo
 * =============================================================================
 */

/**
 * PUT /api/jobs/:id
 * -----------------
 * Actualiza parcialmente un empleo existente.
 *
 * PATH PARAMS:
 *   - id: string (ObjectId de Mongo).
 *
 * BODY (JSON):
 *   - Cualquier subconjunto de los campos del Job.
 *
 * RESPUESTAS:
 *
 *   200 OK:
 *     {
 *       // Job actualizado con "company" adjunto
 *     }
 *
 *   404 Not Found:
 *     { "error": "Empleo no encontrado" }
 */
export async function updateJob(req, res) {
    try {
        const formatted = await updateJobService(req.params.id, req.body);

        if (!formatted) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json(formatted);
    } catch (err) {
        res.status(500).json({
            error: "Error al actualizar empleo",
            details: err.message
        });
    }
}

/* =============================================================================
 *  DELETE /api/jobs/:id — Eliminar un empleo
 * =============================================================================
 */

/**
 * DELETE /api/jobs/:id
 * --------------------
 * Elimina un empleo por su ID.
 *
 * PATH PARAMS:
 *   - id: string (ObjectId de Mongo).
 *
 * RESPUESTAS:
 *
 *   200 OK:
 *     { "message": "Empleo eliminado correctamente" }
 *
 *   404 Not Found:
 *     { "error": "Empleo no encontrado" }
 */
export async function deleteJob(req, res) {
    try {
        const ok = await deleteJobService(req.params.id);

        if (!ok) {
            return res.status(404).json({ error: "Empleo no encontrado" });
        }

        res.json({ message: "Empleo eliminado correctamente" });
    } catch (err) {
        res.status(500).json({
            error: "Error al eliminar empleo",
            details: err.message
        });
    }
}
