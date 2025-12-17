// server.js
dotenv.config();

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import { logger } from "./utils/logger.js";
import { connectDB } from "./connection/db.js";
import { authActor } from "./middlewares/authActor.js";

// Registrar modelos
import "./models/Company.js";
import "./models/Job.js";
import "./models/Location.js";
import "./models/Candidate.js";
import "./models/Application.js";
import "./models/FeaturedCompany.js";

// Rutas
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import logoRoutes from "./routes/logoRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import companyCandidateRoutes from "./routes/companyCandidateRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = path.resolve();

// Middlewares base
app.use(cors());
app.use(express.json());

// Identidad opcional para endpoints públicos
app.use(authActor({ required: false }));

// Assets públicos
app.use("/company_logos", logoRoutes);
app.use("/company_logos", express.static(path.join(__dirname, "data/company_logos")));

// DB
connectDB(true);

// API
app.use("/api/jobs", jobRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/companies/:company_id/candidates", companyCandidateRoutes);
app.use("/api/auth", authRoutes);

// Health
app.get("/", (_req, res) => {
    res.json({ status: "ok" });
});

// Start
app.listen(PORT, HOST, () => {
    logger.success(`Server listening on http://${HOST}:${PORT}`);
});
