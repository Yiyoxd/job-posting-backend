// routes/jobRoutes.js
import { Router } from "express";
import {
    getJobs,
    getJobById,
    getJobsByCompany,
    getJobFilterOptions,
    getJobTitleRecommendations,
    createJob,
    updateJob,
    deleteJob
} from "../controllers/jobController.js";

import { authActor } from "../middlewares/authActor.js";

const router = Router();

/* ------------------------------ Públicas ---------------------------------- */
router.get("/", getJobs);
router.get("/filters/options", getJobFilterOptions);
router.get("/company/:companyId", getJobsByCompany);
router.get("/recommendations/titles", getJobTitleRecommendations);
router.get("/:id", getJobById);

/* ----------------------------- Protegidas --------------------------------- */
// Crear empleo: company/admin
router.post(
    "/",
    authActor({ required: true, roles: ["company", "admin"] }),
    createJob
);

// Actualizar empleo: company/admin
router.put(
    "/:id",
    authActor({ required: true, roles: ["company", "admin"] }),
    updateJob
);

// Eliminar empleo: company/admin
router.delete(
    "/:id",
    authActor({ required: true, roles: ["company", "admin"] }),
    deleteJob
);

export default router;
