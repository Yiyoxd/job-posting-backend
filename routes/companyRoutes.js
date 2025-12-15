// routes/companyRoutes.js
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

import { uploadCompanyLogo } from "../middlewares/uploadLogo.js";
import { authActor } from "../middlewares/authActor.js";
import { authorizeCompanyParam } from "../middlewares/authorizeCompanyParam.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                                  Públicas                                  */
/* -------------------------------------------------------------------------- */

router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.get("/:id/jobs", getCompanyJobs);

/* -------------------------------------------------------------------------- */
/*                               Protegidas                                   */
/* -------------------------------------------------------------------------- */

// Crear nueva empresa (si solo admin crea)
router.post("/", authActor({ required: true, roles: ["admin"] }), createCompany);

// Actualizar empresa (admin o esa misma empresa)
router.put(
    "/:id",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    updateCompany
);

// Eliminar empresa (admin o esa misma empresa)
router.delete(
    "/:id",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    deleteCompany
);

// Actualizar logo
router.put(
    "/:id/logo",
    authActor({ required: true, roles: ["admin", "company"] }),
    authorizeCompanyParam({ param: "id" }),
    uploadCompanyLogo,
    updateCompanyLogo
);

export default router;
