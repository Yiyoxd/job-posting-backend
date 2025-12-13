/**
 * server.js
 *
 * Punto de arranque del backend.
 *
 * Funciones principales:
 *  - Inicializar Express
 *  - Cargar middlewares globales
 *  - Conectar a MongoDB
 *  - Registrar modelos de Mongoose
 *  - Montar rutas del API
 *  - Exponer logos de empresa (static + fallback)
 *  - Levantar el servidor HTTP
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import { logger } from "./utils/logger.js";
import { connectDB } from "./connection/db.js";

// Importar modelos para que Mongoose los registre
import "./models/Company.js";
import "./models/Job.js";
import "./models/Location.js";

// Rutas
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import logoRoutes from "./routes/logoRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = path.resolve();

/* -------------------------------------------------------------------------- */
/*                                 Middlewares                                */
/* -------------------------------------------------------------------------- */
app.use(cors());
app.use(express.json());

/* -------------------------------------------------------------------------- */
/*                               Logos de empresa                              */
/* -------------------------------------------------------------------------- */
/*
 * - /company_logos/processed/:file → ruta con fallback controlado
 * - /company_logos/*               → archivos estáticos
 */
app.use("/company_logos", logoRoutes);
app.use(
    "/company_logos",
    express.static(path.join(__dirname, "data/company_logos"))
);

logger.info("Company logos available at /company_logos");

/* -------------------------------------------------------------------------- */
/*                             Conexión a MongoDB                              */
/* -------------------------------------------------------------------------- */
connectDB();

/* -------------------------------------------------------------------------- */
/*                                  Rutas API                                  */
/* -------------------------------------------------------------------------- */
app.use("/api/jobs", jobRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/companies", companyRoutes);

/* -------------------------------------------------------------------------- */
/*                                  Healthcheck                                */
/* -------------------------------------------------------------------------- */
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        service: "job-posting-backend"
    });
});

/* -------------------------------------------------------------------------- */
/*                               Arranque servidor                             */
/* -------------------------------------------------------------------------- */
app.listen(PORT, HOST, () => {
    logger.success(`Server listening on http://${HOST}:${PORT}`);
});
