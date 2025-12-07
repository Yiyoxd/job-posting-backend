import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    name: String,
    description: String,
    state: String,
    country: String,
    city: String,
    address: String,
    url: String,
    company_size_min: Number,
    company_size_max: Number
});

export default mongoose.model("Company", companySchema);
