import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
    job_id: {
        type: String,
        trim: true,
        index: true // el unique lo creas después en tu script
    },

    title: {
        type: String,
        trim: true
        // el índice de texto se crea en el script, NO aquí
    },

    description: String,

    max_salary: Number,
    min_salary: Number,
    pay_period: String,
    currency: String,

    job_posting_url: String,

    listed_time: {
        type: Date,
        index: true
    },

    work_type: String,
    normalized_salary: Number,

    city: String,
    state: String,
    country: {
        type: String,
        index: true
    },

    // referencia a Company
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true
    }

}, {
    timestamps: true
});

export default mongoose.model("Job", jobSchema);
