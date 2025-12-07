import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
    job_id: Number,
    company_name: String,
    title: String,
    description: String,
    max_salary: Number,
    min_salary: Number,
    pay_period: String,
    currency: String,
    location: String,
    job_posting_url: String,
    listed_time: Number,
    work_type: String,
    normalized_salary: Number,
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" }
});

export default mongoose.model("Job", jobSchema);
