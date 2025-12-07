import { Router } from "express";
import { obtenerJobs } from "../controllers/job.controller.js";

const router = Router();

router.get("/", obtenerJobs);

export default router;
