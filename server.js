/**
 * server.js
 *
 * Inicializa Express, conecta MongoDB,
 * monta rutas del API y sirve los logos de empresa.
 */

import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import { logger } from "./utils/logger.js";
import { connectDB } from "./connection/db.js";

// Registrar modelos (necesario para que Mongoose los conozca)
import "./models/Company.js";
import "./models/Job.js";
import "./models/Location.js";

// Rutas
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";   // ⬅️ AGREGADO

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = path.resolve();

/* ==========================================================
   MIDDLEWARES
========================================================== */
app.use(cors());
app.use(express.json());

/* ==========================================================
   SERVIR LOGOS (MUY IMPORTANTE)
========================================================== */
// ✅ FALLBACK: si piden /company_logos/processed/<id>.png y no existe,
// devuelve data/company_logos/original/DEFAULT_LOGO.png
const LOGOS_BASE_DIR = path.join(__dirname, "data", "company_logos");
const LOGOS_ORIGINAL_DIR = path.join(LOGOS_BASE_DIR, "original");
const LOGOS_PROCESSED_DIR = path.join(LOGOS_BASE_DIR, "processed");
const DEFAULT_LOGO_FILE = "DEFAULT_LOGO.png";

app.get("/company_logos/processed/:file", (req, res) => {
    // Evita path traversal: solo el nombre del archivo
    const file = path.basename(req.params.file || "");

    // (Opcional pero recomendado) solo permitir *.png como tu contrato
    if (!file.toLowerCase().endsWith(".png")) {
        return res.status(400).json({ error: "Archivo inválido" });
    }

    const processedPath = path.join(LOGOS_PROCESSED_DIR, file);
    const fallbackPath = path.join(LOGOS_ORIGINAL_DIR, DEFAULT_LOGO_FILE);

    if (fs.existsSync(processedPath)) {
        return res.sendFile(processedPath);
    }

    if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
    }

    return res.status(404).json({ error: "Logo no encontrado y DEFAULT_LOGO.png no existe" });
});

// Expone todas las imágenes en:
//   http://localhost:8000/company_logos/processed/<id>.png
app.use(
    "/company_logos",
    express.static(path.join(__dirname, "data/company_logos"))
);

logger.info("📁 Static logos mounted at /company_logos");

/* ==========================================================
   CONEXIÓN A MONGO
========================================================== */
connectDB();

/* ==========================================================
   RUTAS DEL API
========================================================== */
app.use("/api/jobs", jobRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/companies", companyRoutes);   // ⬅️ SUPER IMPORTANTE

/* ==========================================================
   RUTA BASE
========================================================== */
app.get("/", (req, res) => {
    res.json({ message: "Backend started successfully" });
});

/* ==========================================================
   LEVANTAR SERVIDOR
========================================================== */
app.listen(PORT, HOST, () => {
    logger.success(`🚀 Server running at http://${HOST}:${PORT}`);
});
