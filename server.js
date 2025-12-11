import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./connection/db.js";

// IMPORTA PRIMERO TODOS LOS MODELOS
import "./models/Company.js";
import "./models/Job.js";
import "./models/Location.js";   // si lo tienes

// Luego importa rutas
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
connectDB();

// Rutas
app.use("/api/jobs", jobRoutes);
app.use("/api/locations", locationRoutes);

// Ruta base
app.get("/", (req, res) => {
    res.json({ message: "Backend started successfully" });
});

// Levantar servidor
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
