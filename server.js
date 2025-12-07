import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {connectDB} from "./connection/db.js";
import jobRoutes from "./routes/job.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api/jobs", jobRoutes);

app.get("/", (req, res) => {
    res.json({ message: "Backend started successfully" });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
