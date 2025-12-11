import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/job_posting_db";

export const connectDB = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;

        mongoose.set("strictQuery", true);

        await mongoose.connect(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });

        console.log("✔ MongoDB connected:", MONGO_URI);
    } catch (err) {
        console.error("❌ MongoDB error:", err.message);
        process.exit(1);
    }
};
