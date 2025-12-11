import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // índice simple, NO unique; el unique lo pone tu script
    },

    description: String,

    country: {
        type: String,
        index: true // útil para filtros
    },
    state: String,
    city: String,

    address: String,
    url: String,

    company_size_min: Number,
    company_size_max: Number

}, {
    timestamps: true
});

export default mongoose.model("Company", companySchema);
