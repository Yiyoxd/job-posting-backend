// conexion/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const conectarDB = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/job_posting_db";

        mongoose.set("strictQuery", true);

        await mongoose.connect(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });

        console.log("✔ MongoDB conectado");
    } catch (err) {
        console.error("❌ Error MongoDB:", err.message);
        process.exit(1);
    }
};
