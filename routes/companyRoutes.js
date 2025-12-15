import express from "express";

import {
    getCompanies,
    getCompanyById,
    getCompanyJobs,
    createCompany,
    updateCompany,
    deleteCompany,
    updateCompanyLogo
} from "../controllers/companyController.js";

import {
    getFeaturedCompanies,
    addFeaturedCompany,
    deleteFeaturedCompany
} from "../controllers/companyFeaturedController.js";

import { uploadCompanyLogo } from "../middlewares/uploadLogo.js";
import { authActor } from "../middlewares/authActor.js";
import { authorizeCompanyParam } from "../middlewares/authorizeCompanyParam.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                        Empresas destacadas (Home)                           */
/* -------------------------------------------------------------------------- */

// Público (Home)
router.get("/featured", getFeaturedCompanies);

// Admin (CRUD)
router.post("/featured", authActor({ required: true, roles: ["admin"] }), addFeaturedCompany);
router.delete("/featured/:companyId", authActor({ required: true, roles: ["admin"] }), deleteFeaturedCompany);

/* -------------------------------------------------------------------------- */
/*                                  Públicas                                  */
/* -------------------------------------------------------------------------- */

router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.get("/:id/jobs", getCompanyJobs);

/* -------------------------------------------------------------------------- */
/*                               Protegidas                                   */
/* -------------------------------------------------------------------------- */

router.post("/", authActor({ required: true, roles: ["admin"] }), createCompany);

router.put(
    "/:id",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    updateCompany
);

router.delete(
    "/:id",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    deleteCompany
);

router.put(
    "/:id/logo",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    uploadCompanyLogo,
    updateCompanyLogo
);

export default router;
