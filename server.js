/**
 * server.js
 *
 * Inicializa Express, conecta MongoDB,
 * monta rutas del API y sirve los logos de empresa.
 */

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
