/**
 * ============================================================================
 * User.js — MODELO DE USUARIO (CUENTA)
 * ============================================================================
 *
 * Representa credenciales + tipo de usuario.
 *
 * - type: "admin" | "company" | "candidate"
 * - company_id / candidate_id enlazan con perfiles (Company/Candidate) si aplica
 * - user_id incremental usando Counter
 * ============================================================================
 */

import mongoose from "mongoose";
import Counter from "./Counter.js";

const userSchema = new mongoose.Schema(
    {
        user_id: {
            type: Number,
            unique: true,
            index: true
        },

        type: {
            type: String,
            enum: ["admin", "company", "candidate"],
            required: true,
            index: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        password_hash: {
            type: String,
            required: true
        },

        company_id: {
            type: Number,
            index: true,
            default: null
        },

        candidate_id: {
            type: Number,
            index: true,
            default: null
        }
    },
    { timestamps: true }
);

/* =============================================================================
 * INCREMENTAL AUTOMÁTICO (user_id)
 * ============================================================================= */
userSchema.pre("save", async function (next) {
    if (this.user_id != null) return next();

    const counter = await Counter.findOneAndUpdate(
        { _id: "user_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.user_id = counter.seq;
    next();
});

/* =============================================================================
 * LIMPIEZA DE SALIDA (JSON / OBJECT)
 * ============================================================================= */
const cleanTransform = (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.password_hash;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
};

userSchema.set("toJSON", { versionKey: false, virtuals: false, transform: cleanTransform });
userSchema.set("toObject", { versionKey: false, virtuals: false, transform: cleanTransform });

export default mongoose.model("User", userSchema);
