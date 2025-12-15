// routes/companyCandidateRoutes.js
import express from "express";
import { listCandidatesForCompanyController } from "../controllers/candidateController.js";
import { authActor } from "../middlewares/authActor.js";

const router = express.Router();

/**
 * GET /api/companies/:company_id/candidates
 * - company: solo su propia company_id
 * - admin: permitido
 */
router.get(
    "/:company_id/candidates",
    authActor({ required: true, roles: ["admin", "company"] }),
    listCandidatesForCompanyController
);

export default router;
