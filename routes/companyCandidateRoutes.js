// routes/companyCandidateRoutes.js
import { Router } from "express";
import { listCandidatesForCompanyController } from "../controllers/candidateController.js";

import { authActor } from "../middlewares/authActor.js";
import { authorizeCompanyParam } from "../middlewares/authorizeCompanyParam.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:company_id/candidates
router.get(
    "/",
    authActor({ required: true, roles: ["company", "admin"] }),
    authorizeCompanyParam({ param: "company_id" }),
    listCandidatesForCompanyController
);

export default router;
