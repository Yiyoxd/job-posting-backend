// connection/db.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/job_posting_db";

export const connectDB = async (debug = false) => {
    try {
        const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;

        mongoose.set("strictQuery", true);
        mongoose.set("debug", false);

        await mongoose.connect(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000
        });

        if (debug) {
            logger.success(`MongoDB connected: ${MONGO_URI}`);
        }
    } catch (err) {
        logger.error(`MongoDB error: ${err.message}`);
        process.exit(1);
    }
};
