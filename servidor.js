import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import conectarDB from "./conexion/db.js";
import jobRoutes from "./rutas/job.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

conectarDB();

app.use("/api/jobs", jobRoutes);

app.get("/", (req, res) => {
    res.json({ message: "Backend iniciado correctamente" });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
