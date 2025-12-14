/**
 * ============================================================================
 *  jobController.js — CONTROLADOR HTTP DE EMPLEOS (EXPRESS)
 * ============================================================================
 *
 * ESTE ARCHIVO:
 *   - Lee req.query / req.params / req.body
 *   - Llama a funciones del jobService
 *   - Maneja errores y status codes
 *   - Define el contrato HTTP consumido por el frontend
 *
 * Endpoints (ver jobRoutes.js):
 *
 *   GET    /api/jobs
 *   GET    /api/jobs/:id
 *   GET    /api/jobs/company/:companyId
 *   GET    /api/jobs/filters/options
 *   POST   /api/jobs
 *   PUT    /api/jobs/:id
 *   DELETE /api/jobs/:id
 * ============================================================================
 */

import {
    getJobsService,
    getJobByIdService,
    getJobsByCompanyService,
    getJobFilterOptionsService,
    getJobTitleRecommendationsService,
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
 * QUERY PARAMS (opcionales, combinables):
 *   - q                  : string
 *   - country            : string
 *   - state              : string
 *   - city               : string
 *   - work_type          : string
 *   - work_location_type : string   (ONSITE | HYBRID | REMOTE)
 *   - pay_period         : string
 *   - company_id         : number
 *   - min_salary         : number
 *   - max_salary         : number
 *   - min_norm_salary    : number
 *   - max_norm_salary    : number
 *   - listed_from        : string (YYYY-MM-DD)
 *   - listed_to          : string (YYYY-MM-DD)
 *   - page               : number (default = 1)
 *   - limit              : number (default = 20)
 *   - sortBy             : listed_time | min_salary | max_salary | normalized_salary | createdAt
 *   - sortDir            : asc | desc (default = desc)
 *   - include_company    : boolean ("true" | "false") (default = true)
 *
 * RESPUESTA (200 OK):
 *   {
 *     "meta": { "page": number, "limit": number, "total": number, "totalPages": number },
 *     "data": [
 *       {
 *         // Campos del Job
 *         "company": { ... } // presente solo si include_company=true
 *       }
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
 * Obtiene un empleo individual por su ID.
 *
 * PATH PARAMS:
 *   - id: number (job_id del Job).
 *
 * QUERY PARAMS:
 *   - include_company : boolean ("true" | "false") (default = true)
 *
 * RESPUESTAS:
 *   200 OK:
 *     {
 *       // Campos del Job
 *       "company": { ... } // presente solo si include_company=true
 *     }
 *   404 Not Found:
 *     { "error": "Empleo no encontrado" }
 */
export async function getJobById(req, res) {
    try {
        const includeCompany = String(req.query.include_company ?? "true").toLowerCase() !== "false";
        const job = await getJobByIdService(req.params.id, { includeCompany });

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
 * Lista empleos pertenecientes a una empresa específica, aplicando filtros,
 * paginación, ordenamiento y reglas de ranking.
 *
 * PATH PARAMS:
 *   - companyId: number (company_id de la empresa).
 *
 * QUERY PARAMS:
 *   - mismos que /api/jobs (excepto company_id)
 *   - include_company : boolean ("true" | "false") (default = true)
 *
 * RESPUESTA:
 *   { "meta": { ... }, "data": [ ... ] }
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
 * Devuelve valores únicos (distinct) para construir filtros.
 *
 * RESPUESTA (200 OK):
 *   {
 *     "work_types":          string[],
 *     "work_location_types": string[],
 *     "pay_periods":         string[]
 *   }
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

/**
 * =============================================================================
 * jobRecommendationController.js
 * =============================================================================
 *
 * Controlador HTTP para recomendaciones relacionadas con empleos.
 *
 * Este controlador NO implementa lógica de negocio.
 * Su responsabilidad es:
 *
 *   - Leer parámetros de entrada desde req.query
 *   - Validar y normalizar inputs básicos
 *   - Delegar la lógica al service correspondiente
 *   - Definir el contrato HTTP de salida para el frontend
 *
 * -----------------------------------------------------------------------------
 * Endpoint expuesto:
 *
 *   GET /api/jobs/recommendations/titles
 *
 * Query params:
 *   - q      (string, requerido)
 *       Texto parcial ingresado por el usuario.
 *       Ejemplos:
 *         "software"
 *         "data"
 *         "backend"
 *
 *   - limit  (number, opcional, default: 10)
 *       Número máximo de sugerencias a retornar.
 *
 * -----------------------------------------------------------------------------
 * Ejemplo de request:
 *
 *   GET /api/jobs/recommendations/titles?q=software&limit=8
 *
 * -----------------------------------------------------------------------------
 * Ejemplo de response (200 OK):
 *
 * {
 *   "query": "software",
 *   "suggestions": [
 *     "Software Engineer",
 *     "Senior Software Engineer",
 *     "Backend Software Developer",
 *     "Full Stack Software Engineer"
 *   ]
 * }
 *
 * -----------------------------------------------------------------------------
 * Notas de diseño:
 *
 * - Este endpoint está pensado para:
 *     • Autocompletado
 *     • Sugerencias de búsqueda
 *     • Recomendaciones semánticas simples
 *
 * - NO devuelve jobs completos.
 * - NO pagina resultados.
 * - NO aplica filtros de país, salario, etc.
 *
 * - Toda la lógica de ranking y relevancia vive en:
 *     services/jobRecommendationService.js
 *
 * =============================================================================
 */

/**
 * GET /api/jobs/recommendations/titles
 *
 * Controlador para obtener recomendaciones de títulos de empleo
 * basadas en un texto parcial ingresado por el usuario.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function getJobTitleRecommendations(req, res, next) {
    try {
        // ---------------------------------------------------------------------
        // 1️⃣ Lectura de parámetros de entrada
        // ---------------------------------------------------------------------
        const { q, limit } = req.query;

        // ---------------------------------------------------------------------
        // 2️⃣ Validación mínima de entrada
        // ---------------------------------------------------------------------
        // - q es requerido
        // - si no viene o viene vacío, se responde con arreglo vacío
        //   (esto evita errores innecesarios en el frontend)
        if (!q || typeof q !== "string" || !q.trim()) {
            return res.status(200).json({
                query: q ?? "",
                suggestions: []
            });
        }

        // ---------------------------------------------------------------------
        // 3️⃣ Normalización de parámetros
        // ---------------------------------------------------------------------
        const parsedLimit = Number(limit);

        const safeLimit =
            Number.isInteger(parsedLimit) && parsedLimit > 0
                ? parsedLimit
                : 10;

        // ---------------------------------------------------------------------
        // 4️⃣ Delegar al service
        // ---------------------------------------------------------------------
        const suggestions = await getJobTitleRecommendationsService(q, {
            limit: safeLimit
        });

        // ---------------------------------------------------------------------
        // 5️⃣ Respuesta HTTP
        // ---------------------------------------------------------------------
        return res.status(200).json({
            query: q,
            suggestions
        });
    } catch (error) {
        // ---------------------------------------------------------------------
        // 6️⃣ Manejo de errores
        // ---------------------------------------------------------------------
        // El controlador NO decide cómo responder errores fatales.
        // Se delega al middleware global de errores.
        next(error);
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
 *   - id: number (job_id del Job).
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
 *   - id: number (job_id del Job).
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
