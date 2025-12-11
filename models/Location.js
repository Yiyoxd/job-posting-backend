import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
    _id: String, // C-1, S-22, CI-991
    type: {
        type: String,
        enum: ["country", "state", "city"],
        required: true,
    },
    name: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    country_id: {
        type: String,
        default: null,
    },
    state_id: {
        type: String,
        default: null,
    },
});

export default mongoose.model("Location", LocationSchema);
