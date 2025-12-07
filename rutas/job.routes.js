import { Router } from "express";
import { obtenerJobs } from "../controladores/job.controller.js";

const router = Router();

router.get("/", obtenerJobs);

export default router;
