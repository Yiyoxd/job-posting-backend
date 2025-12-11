import mongoose from "mongoose";

/**
 * Location — Esquema en forma de ÁRBOL.
 *
 * Cada documento representa UN PAÍS completo.
 *
 * {
 *   country: "Mexico",
 *   states: [
 *     {
 *       state: "Coahuila",
 *       cities: ["Torreón", "Saltillo"]
 *     },
 *     ...
 *   ]
 * }
 */

const LocationSchema = new mongoose.Schema({
    country: {
        type: String,
        required: true,
        trim: true,
        index: true,
        unique: true
    },

    states: [
        {
            state: {
                type: String,
                required: true,
                trim: true
            },
            cities: {
                type: [String],
                default: [],
            }
        }
    ]
});

export default mongoose.model("Location", LocationSchema);