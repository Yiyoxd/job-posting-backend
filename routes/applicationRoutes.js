/**
 * ============================================================================
 * applicationRoutes.js — Rutas HTTP de Postulaciones (Application)
 * ============================================================================
 *
 * Prefijo recomendado en server.js:
 *   app.use("/api/applications", applicationRoutes);
 *
 * Requiere:
 * - authActor({ required: true }) en todas las rutas
 *
 * Nota:
 * - Este router NO decide permisos de negocio.
 * - Solo garantiza que req.actor exista.
 * - La validación fina vive en applicationService.
 * ============================================================================
 */

import { Router } from "express";
import { authActor } from "../middlewares/authActor.js";

import {
    createApplicationController,
    getApplicationByIdController,
    getCompanyApplicationDetailController,
    getApplicationStatusController,
    getStatusesForJobsController,
    listApplicationsByCandidateController,
    listApplicationsByCompanyController,
    listCompanyApplicationsWithCandidateController,
    updateApplicationStatusController,
    withdrawApplicationController,
    getCompanyPipelineCountsController
} from "../controllers/applicationController.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                         RUTAS BASE /api/applications                        */
/* -------------------------------------------------------------------------- */

// Crear postulación
router.post(
    "/",
    authActor({ required: true }),
    createApplicationController
);

// Status de un candidato para un job
router.get(
    "/status",
    authActor({ required: true }),
    getApplicationStatusController
);

// Obtener postulación por ID
router.get(
    "/:application_id",
    authActor({ required: true }),
    getApplicationByIdController
);



// Status en batch (job_id -> status)
router.post(
    "/statuses",
    authActor({ required: true }),
    getStatusesForJobsController
);

// Retirar postulación
router.delete(
    "/",
    authActor({ required: true }),
    withdrawApplicationController
);

/* -------------------------------------------------------------------------- */
/*                 RUTAS POR CANDIDATO /api/candidates/:id/...                */
/* -------------------------------------------------------------------------- */

// Lista de postulaciones de un candidato
router.get(
    "/candidates/:candidate_id/applications",
    authActor({ required: true }),
    listApplicationsByCandidateController
);

/* -------------------------------------------------------------------------- */
/*                 RUTAS POR EMPRESA /api/companies/:id/...                   */
/* -------------------------------------------------------------------------- */

// Lista de postulaciones de una empresa (sin candidato)
router.get(
    "/companies/:company_id/applications",
    authActor({ required: true }),
    listApplicationsByCompanyController
);

// Lista de postulaciones con candidato + cv
router.get(
    "/companies/:company_id/applications_with_candidates",
    authActor({ required: true }),
    listCompanyApplicationsWithCandidateController
);

// Detalle de postulación para empresa
router.get(
    "/companies/:company_id/applications/:application_id",
    authActor({ required: true }),
    getCompanyApplicationDetailController
);

// Actualizar status de postulación
router.patch(
    "/companies/:company_id/applications/:application_id/status",
    authActor({ required: true }),
    updateApplicationStatusController
);

// Conteos del pipeline
router.get(
    "/companies/:company_id/applications/pipeline_counts",
    authActor({ required: true }),
    getCompanyPipelineCountsController
);

export default router;
