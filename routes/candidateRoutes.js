// routes/candidateRoutes.js
import express from "express";

import {
    getCandidateByIdController,
    updateCandidateController,
    getCandidateCvController
} from "../controllers/candidateController.js";

import { authActor } from "../middlewares/authActor.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                                Protegidas                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/candidates/:candidate_id
 * - candidate: solo su propio perfil
 * - company: solo si existe relación por postulación (Application)
 * - admin: permitido
 */
router.get(
    "/:candidate_id",
    authActor({ required: true, roles: ["admin", "company", "candidate"] }),
    getCandidateByIdController
);

/**
 * PATCH /api/candidates/:candidate_id
 * - candidate: solo su propio perfil
 * - admin: permitido
 */
router.patch(
    "/:candidate_id",
    authActor({ required: true, roles: ["admin", "candidate"] }),
    updateCandidateController
);

/**
 * GET /api/candidates/:candidate_id/cv
 * - candidate: solo su propio CV
 * - company: solo si existe relación por postulación (Application)
 * - admin: permitido
 */
router.get(
    "/:candidate_id/cv",
    authActor({ required: true, roles: ["admin", "company", "candidate"] }),
    getCandidateCvController
);

export default router;
