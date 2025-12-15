// routes/candidateRoutes.js
import { Router } from "express";

import {
    createCandidateController,
    getCandidateByIdController,
    updateCandidateController,
    getCandidateCvController
} from "../controllers/candidateController.js";

import { authActor } from "../middlewares/authActor.js";
import { authorizeCandidateParam } from "../middlewares/authorizeCandidateParam.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                                  Públicas                                  */
/* -------------------------------------------------------------------------- */


// crear un perfil
router.post("/", createCandidateController);

/* -------------------------------------------------------------------------- */
/*                               Protegidas                                   */
/* -------------------------------------------------------------------------- */


// Ver perfil del candidato
router.get(
    "/:candidate_id",
    authActor({ required: true, roles: ["candidate", "company", "admin"] }),
    getCandidateByIdController
);

// Actualizar mi perfil (solo dueño o admin)
router.patch(
    "/:candidate_id",
    authActor({ required: true, roles: ["candidate", "admin"] }),
    authorizeCandidateParam({ param: "candidate_id" }),
    updateCandidateController
);

// Descargar/ver CV (autenticado)
router.get(
    "/:candidate_id/cv",
    authActor({ required: true, roles: ["candidate", "company", "admin"] }),
    getCandidateCvController
);

export default router;
