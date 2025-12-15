// services/authService.js

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * loginService
 * -----------------------------------------------------------------------------
 * Valida credenciales de un usuario y genera un token JWT.
 *
 * Responsabilidades:
 * - Verificar existencia del usuario por email
 * - Comparar contraseña en texto plano vs hash
 * - Construir el payload estándar del actor
 * - Firmar y devolver un JWT
 *
 * @param {Object} params
 * @param {string} params.email     Correo del usuario
 * @param {string} params.password  Contraseña en texto plano
 *
 * @returns {Object}
 * {
 *   token: string,
 *   actor: {
 *     user_id: number,
 *     type: "admin" | "company" | "candidate",
 *     company_id?: number | null,
 *     candidate_id?: number | null
 *   }
 * }
 *
 * @throws Error("INVALID_CREDENTIALS")
 * @throws Error("JWT_SECRET_NOT_CONFIGURED")
 */
export async function loginService({ email, password }) {
    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }

    // Comparar contraseña
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
        throw new Error("INVALID_CREDENTIALS");
    }

    // Validar configuración del backend
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET_NOT_CONFIGURED");
    }

    // Construcción del actor estándar
    const actor = {
        user_id: user.user_id,
        type: user.type,
        company_id: user.company_id ?? null,
        candidate_id: user.candidate_id ?? null,
    };

    // Firma del JWT
    const token = jwt.sign(actor, secret, {
        expiresIn: "7d",
    });

    return { token, actor };
}
