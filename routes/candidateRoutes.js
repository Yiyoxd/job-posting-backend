// routes/candidateRoutes.js
import express from "express";
import multer from "multer";

import {
    getCandidateByIdController,
    updateCandidateController,
    getCandidateCvController,
    uploadCandidateCvController
} from "../controllers/candidateController.js";

import { authActor } from "../middlewares/authActor.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
 * POST /api/candidates/:candidate_id/cv
 * - candidate: SOLO su propio CV
 */
router.post(
    "/:candidate_id/cv",
    authActor({ required: true, roles: ["candidate"] }),
    upload.single("cv"),
    uploadCandidateCvController
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
