import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./connection/db.js";
import jobRoutes from "./routes/jobRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";   // ✅ IMPORTANTE

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
app.use("/api/locations", locationRoutes);   // ✅ NUEVA RUTA

// Ruta base
app.get("/", (req, res) => {
    res.json({ message: "Backend started successfully" });
});

// Levantar servidor
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
