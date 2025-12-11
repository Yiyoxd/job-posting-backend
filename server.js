/**
 * server.js
 *
 * Inicializa Express, carga variables de entorno, conecta a MongoDB
 * y monta las rutas principales del API.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { logger } from "./utils/logger.js";
import { connectDB } from "./connection/db.js";

// Registrar modelos
import "./models/Company.js";
import "./models/Job.js";
import "./models/Location.js";

// Rutas
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

/* Middlewares */
app.use(cors());
app.use(express.json());

/* Conexión a MongoDB */
connectDB();

/* Rutas del API */
app.use("/api/jobs", jobRoutes);
app.use("/api/locations", locationRoutes);

/* Ruta base */
app.get("/", (req, res) => {
    res.json({ message: "Backend started successfully" });
});

/* Iniciar servidor */
app.listen(PORT, HOST, () => {
    logger.success(`Server running at http://${HOST}:${PORT}`);
});
